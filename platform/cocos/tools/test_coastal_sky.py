import hashlib,json,unittest
from PIL import Image
from generate_coastal_sky import PROJECT,SIZE,direction

class CoastalSkyTest(unittest.TestCase):
 def test_actual_face_provenance_and_sizes(self):
  doc=json.loads((PROJECT/'assets/resources/coastal-sky/provenance.json').read_text())
  self.assertEqual(len(doc['faces']),6)
  self.assertEqual(doc['generatorSHA256'],hashlib.sha256((PROJECT/'tools/generate_coastal_sky.py').read_bytes()).hexdigest())
  for face in doc['faces']:
   path=PROJECT/face['path'];self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),face['sha256'])
   with Image.open(path) as image:self.assertEqual(image.size,(256,256));self.assertEqual(image.mode,'RGB')
 def test_actual_cube_edges_match_at_identical_world_directions(self):
  # Compare encoded pixel edges between adjacent faces, not just generator intent.
  edges={}
  for face in ['right','left','top','bottom','front','back']:
   with Image.open(PROJECT/'assets/resources/coastal-sky'/(face+'.png')) as image:
    for x,y in set([(i,j)for i in range(SIZE)for j in [0,SIZE-1]]+[(j,i)for i in range(SIZE)for j in [0,SIZE-1]]):
     key=tuple(round(v,8)for v in direction(face,2*x/(SIZE-1)-1,2*y/(SIZE-1)-1))
     edges.setdefault(key,[]).append(image.getpixel((x,y)))
  self.assertTrue(all(len(samples)>=2 for samples in edges.values()))
  for samples in edges.values():self.assertEqual(len(set(samples)),1)
if __name__=='__main__':unittest.main()
