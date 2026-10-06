import json
from pathlib import Path
import tempfile
import unittest
from externalize_gltf import externalize,read_glb

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'assets/characters/male_programmer.glb'


class DerivativeTests(unittest.TestCase):
    def test_real_character_geometry_rig_animation_and_images_preserved(self):
        before,original,binary=read_glb(SOURCE)
        with tempfile.TemporaryDirectory() as folder:
            r=externalize(SOURCE,folder,'programmer');directory=Path(folder)
            derived=json.loads((directory/'programmer.gltf').read_text());geometry=(directory/'programmer.bin').read_bytes()
            for section in ['nodes','skins','animations','meshes','materials','scenes']:
                self.assertEqual(derived.get(section),original.get(section),section)
            self.assertEqual(len(derived['skins'][0]['joints']),53)
            self.assertEqual(len(derived['animations']),8)
            for old_index,new_index in r['bufferViewMap'].items():
                a=original['bufferViews'][old_index];b=derived['bufferViews'][new_index]
                self.assertEqual(binary[a.get('byteOffset',0):a.get('byteOffset',0)+a['byteLength']],geometry[b['byteOffset']:b['byteOffset']+b['byteLength']])
                self.assertEqual(b['byteOffset']%4,0)
            for a,b in zip(original['accessors'],derived['accessors']):
                expected=dict(a)
                if 'bufferView' in expected:expected['bufferView']=r['bufferViewMap'][expected['bufferView']]
                self.assertEqual(b,expected)
            for a,b in zip(original['images'],derived['images']):
                v=original['bufferViews'][a['bufferView']]
                self.assertEqual((directory/b['uri']).read_bytes(),binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
            self.assertEqual(SOURCE.read_bytes(),before)

    def test_repeated_export_is_deterministic_and_shares_texture_files(self):
        with tempfile.TemporaryDirectory() as folder:
            a=externalize(SOURCE,folder,'a');count=len(list((Path(folder)/'textures').glob('*.png')))
            b=externalize(SOURCE,folder,'b')
            self.assertEqual(a['binSHA256'],b['binSHA256'])
            self.assertEqual(a['images'],b['images'])
            self.assertEqual(len(list((Path(folder)/'textures').glob('*.png'))),count)

    def test_corrupt_source_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'bad.glb';p.write_bytes(b'bad GLB')
            with self.assertRaises(ValueError):externalize(p,folder,'bad')
            self.assertFalse((Path(folder)/'bad.gltf').exists())


if __name__=='__main__':unittest.main()
