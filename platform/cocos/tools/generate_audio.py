"""Original deterministic PCM sound bank. No sampled third-party recordings."""
import hashlib
import json
import math
from pathlib import Path
import random
import struct
import wave

RATE=22050

def synth(name,duration,frequency,end,noise=0):
    rng=random.Random(name);samples=[];phase=0
    for i in range(round(duration*RATE)):
        t=i/RATE;p=t/duration
        phase+=2*math.pi*(frequency+(end-frequency)*p)/RATE
        envelope=min(1,t/.008)*min(1,(duration-t)/.015)*math.exp(-3*p)
        samples.append(.42*envelope*((1-noise)*math.sin(phase)+noise*rng.uniform(-1,1)))
    samples[0]=samples[-1]=0
    return samples

def generate(output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True);bank=[]
    sounds={
        'shot':synth('shot',.1,180,45,.85),
        'reload':synth('reload',.12,310,150,.55)+[0]*round(.06*RATE)+synth('reload2',.07,420,220,.3),
        'empty':synth('empty',.045,320,250,.1),
        'ambient':synth('ambient',2,70,70,.15),
        'step':synth('step',.12,85,45,.35),
        'hit':synth('hit',.19,160,48,.55),
        'skill':synth('skill',.35,130,850,.12),
        'danger':synth('danger',.12,660,660)+[0]*round(.07*RATE)+synth('danger2',.15,480,480),
        'notice':synth('notice',.18,740,988)+synth('notice2',.18,988,988),
    }
    for bpm in [108,132,158,184]:
        period=round(60/bpm*RATE);beat=synth('pulse',.12,62,42,.2)
        # Four exact equal-length beats; silent tails make the loop continuous.
        sounds['pulse_'+str(bpm)]=(beat+[0]*(period-len(beat)))*4
    for name,samples in sounds.items():
        pcm=struct.pack('<'+'h'*len(samples),*(round(max(-1,min(1,s))*32767)for s in samples))
        path=output/(name+'.wav')
        with wave.open(str(path),'wb')as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm)
        bank.append({'name':name,'path':name+'.wav','frames':len(samples),'sampleRate':RATE,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'peak':max(abs(s)for s in samples)})
    manifest={'license':'Original project-generated sounds; no third-party samples','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'clips':bank}
    (output/'bank.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

if __name__=='__main__':
    import sys
    result=generate(sys.argv[1]);print('Generated',len(result['clips']),'original PCM clips')
