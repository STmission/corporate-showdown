import copy
from pathlib import Path
import unittest
from conversation_gltf import append_conversation
from externalize_gltf import read_glb

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'assets/characters/male_programmer.glb'
BANK=ROOT/'assets/animations/conversation-v1/workplace-conversation.glb'

class ConversationDerivativeTests(unittest.TestCase):
    def setUp(self):
        self.raw,self.doc,self.binary=read_glb(SOURCE)

    def test_deterministic_append_preserves_authored_sections_and_refuses_duplicates(self):
        before=copy.deepcopy(self.doc)
        a,data=append_conversation(self.doc,self.binary,BANK,'male_programmer','Listen')
        b,again=append_conversation(self.doc,self.binary,BANK,'male_programmer','Listen')
        self.assertEqual(a,b);self.assertEqual(data,again);self.assertEqual(self.doc,before)
        self.assertEqual(SOURCE.read_bytes(),self.raw)
        self.assertEqual(data[:len(self.binary)],self.binary)
        for section in ['nodes','meshes','skins','materials','scenes']:
            self.assertEqual(a[section],self.doc[section])
        self.assertEqual(a['animations'][:8],self.doc['animations'])
        with self.assertRaisesRegex(ValueError,'already exists'):
            append_conversation(a,data,BANK,'male_programmer','Listen')

    def test_incompatible_rigs_and_undecomposed_rest_matrices_are_rejected(self):
        bad=copy.deepcopy(self.doc);next(n for n in bad['nodes'] if n.get('name')=='head')['name']='missing_head'
        with self.assertRaisesRegex(ValueError,'Missing target bone'):
            append_conversation(bad,self.binary,BANK,'sample','Explain')
        bad=copy.deepcopy(self.doc);next(n for n in bad['nodes'] if n.get('name')=='head')['matrix']=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
        with self.assertRaisesRegex(ValueError,'rest matrices'):
            append_conversation(bad,self.binary,BANK,'sample','Explain')

    def test_unknown_styles_and_invalid_skeleton_count_are_rejected(self):
        with self.assertRaisesRegex(ValueError,'Unknown conversation style'):
            append_conversation(self.doc,self.binary,BANK,'sample','Invented')
        bad=copy.deepcopy(self.doc);bad['skins'][0]['joints'].pop()
        with self.assertRaisesRegex(ValueError,'53-joint'):
            append_conversation(bad,self.binary,BANK,'sample','Comfort')

if __name__=='__main__':unittest.main()
