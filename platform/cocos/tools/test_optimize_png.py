import tempfile
from pathlib import Path
import struct
import unittest
import zlib
from optimize_png import SIGNATURE, chunk, optimize, run


def fixture():
    # Valid RGBA image with alpha and explicit color metadata, split across IDAT chunks.
    raw = (b'\x00' + b'\x40\x60\x80\x90' * 32) * 32
    encoded = zlib.compress(raw, 0)
    return SIGNATURE + chunk(b'IHDR', struct.pack('>IIBBBBB',32,32,8,6,0,0,0)) + chunk(b'sRGB',b'\x00') + chunk(b'gAMA',struct.pack('>I',45455)) + chunk(b'IDAT',encoded[:20]) + chunk(b'IDAT',encoded[20:]) + chunk(b'IEND',b''), raw


class PngOptimizationTests(unittest.TestCase):
    def test_pixels_and_color_chunks_stay_exact(self):
        original, raw = fixture()
        output, evidence = optimize(original)
        self.assertLess(len(output),len(original))
        offset, payloads = 8, []
        while offset < len(output):
            size=struct.unpack_from('>I',output,offset)[0]
            if output[offset+4:offset+8] == b'IDAT': payloads.append(output[offset+8:offset+8+size])
            offset += size+12
        self.assertEqual(zlib.decompress(b''.join(payloads)),raw)
        self.assertIn(chunk(b'sRGB',b'\x00'),output)
        self.assertIn(chunk(b'gAMA',struct.pack('>I',45455)),output)
        self.assertIn('metadataSHA256',evidence)
        self.assertEqual(optimize(output)[0],output)

    def test_glb_alignment_padding_is_preserved(self):
        original,_=fixture()
        for count in range(1,4):
            output,evidence=optimize(original+b'\x00'*count)
            self.assertTrue(output.endswith(b'\x00'*count))
            self.assertEqual(evidence['preservedPaddingBytes'],count)

    def test_corrupt_crc_refused(self):
        original,_=fixture()
        damaged=bytearray(original);damaged[50]^=1
        with self.assertRaises(ValueError):optimize(bytes(damaged))

    def test_truncation_and_trailing_data_refused(self):
        original,_=fixture()
        for invalid in [original[:-1],original+b'extra',b'not PNG']:
            with self.assertRaises(ValueError):optimize(invalid)

    def test_broken_deflate_refused(self):
        original,_=fixture()
        invalid=original[:33]+chunk(b'IDAT',b'broken deflate')+chunk(b'IEND',b'')
        with self.assertRaises(zlib.error):optimize(invalid)

    def test_invalid_build_file_is_not_modified(self):
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'bad.png';target.write_bytes(b'bad')
            with self.assertRaises(ValueError):run(d,str(Path(d)/'report.json'))
            self.assertEqual(target.read_bytes(),b'bad')
            self.assertFalse((Path(d)/'report.json').exists())

    def test_duplicate_assets_keep_paths_and_non_images(self):
        with tempfile.TemporaryDirectory() as d:
            original,_=fixture()
            for n in ['a.png','b.png']:(Path(d)/n).write_bytes(original)
            marker=Path(d)/'mesh.bin';marker.write_bytes(b'geometry')
            run(d,str(Path(d)/'report.json'))
            self.assertEqual((Path(d)/'a.png').read_bytes(),(Path(d)/'b.png').read_bytes())
            self.assertEqual(marker.read_bytes(),b'geometry')


if __name__ == '__main__': unittest.main()
