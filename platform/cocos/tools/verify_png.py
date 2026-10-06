"""Independent Pillow decoding of optimized resource images vs importer originals."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def verify(project, platform, report):
    project=Path(project)
    build=project/'build'/platform
    manifest=json.loads(Path(report).read_text())
    entries=[]
    for entry in manifest['entries']:
        target=build/entry['path']
        name=target.name
        source=project/'library'/name[:2]/name
        if not source.exists():
            continue
        if hashlib.sha256(source.read_bytes()).hexdigest()!=entry['beforeSHA256']:
            raise ValueError('Importer source changed: '+str(source))
        with Image.open(source) as a, Image.open(target) as b:
            if a.size!=b.size or a.mode!=b.mode or a.tobytes()!=b.tobytes() or a.info!=b.info:
                raise ValueError('Decoded pixels or color metadata changed: '+str(target))
            entries.append({'path':entry['path'],'size':a.size,'mode':a.mode,'decodedSHA256':hashlib.sha256(a.tobytes()).hexdigest()})
    expected=[e for e in manifest['entries'] if e['path'].startswith('assets/resources/')]
    if len(entries)<len(expected):
        raise ValueError('Resource images missing from importer comparison')
    return {'scope':'independent Pillow decode and image metadata comparison; not renderer or device validation','count':len(entries),'entries':entries}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('project');parser.add_argument('platform');parser.add_argument('optimization_report');parser.add_argument('output')
    args=parser.parse_args()
    result=verify(args.project,args.platform,args.optimization_report)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print('Decoded images verified:',result['count'])
