"""Original deterministic daylight cube faces. No downloaded/reference imagery."""
import hashlib,json,math
from pathlib import Path
from PIL import Image
PROJECT=Path(__file__).resolve().parents[1]
SIZE=256

def direction(face,u,v):
    return {'right':(1,-v,-u),'left':(-1,-v,u),'top':(u,1,v),'bottom':(u,-1,-v),'front':(u,-v,1),'back':(-u,-v,-1)}[face]

def color(direction):
    x,y,z=direction;length=math.sqrt(x*x+y*y+z*z);x,y,z=x/length,y/length,z/length
    t=max(0,y)**.45
    horizon=(210,231,234);zenith=(81,153,214)
    rgb=[a+(b-a)*t for a,b in zip(horizon,zenith)]
    # Direction-based continuous cloud veil and warm daylight halo; seams share directions.
    veil=max(0,math.sin(x*15+z*9+y*5)+math.sin(z*19-x*7)-.65)*.12*max(0,min(1,(y-.08)*3))
    sun=max(0,x*-.42+y*.75+z*-.51)**90*.7
    return tuple(round(max(0,min(255,c+(255-c)*min(.8,veil+sun)))) for c in rgb)

def generate():
    out=PROJECT/'assets/resources/coastal-sky';out.mkdir(parents=True,exist_ok=True);faces=[]
    for face in ['right','left','top','bottom','front','back']:
        image=Image.new('RGB',(SIZE,SIZE));image.putdata([color(direction(face,2*x/(SIZE-1)-1,2*y/(SIZE-1)-1))for y in range(SIZE)for x in range(SIZE)])
        path=out/(face+'.png');image.save(path,optimize=True)
        faces.append({'face':face,'path':str(path.relative_to(PROJECT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'width':SIZE,'height':SIZE})
    report={'version':'coastal-daylight-v1','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'license':'CC0-1.0 project-authored pixels; no external imagery','faces':faces,'scope':'visual daytime background, not calibrated HDR/IBL lighting'}
    (out/'provenance.json').write_text(json.dumps(report,indent=2)+'\n');print('Generated six original daylight faces')
if __name__=='__main__':generate()
