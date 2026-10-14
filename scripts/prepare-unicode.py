import csv,json,pathlib,hashlib,argparse
from fontTools.ttLib import TTFont
p=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Rebuild the bundled character manifest from source TSVs.')
parser.add_argument('--selected-tsv',required=True,type=pathlib.Path)
parser.add_argument('--full-tsv',required=True,type=pathlib.Path)
args=parser.parse_args()
s=args.selected_tsv
fonts={}
for name in ['NotoSansSymbols2','NotoSansMath','NotoSansArmenian','NotoSans']:
 f=TTFont(p/'public/fonts'/f'{name}-Regular.ttf'); fonts[name]=(set(f.getBestCmap()),f['name'].getDebugName(5))
rows=list(csv.DictReader(s.open(encoding='utf-8-sig'),delimiter='\t'))
for r in rows: r['source_version']='unicode-17-v1-2000'
full=list(csv.DictReader(args.full_tsv.open(encoding='utf-8-sig'),delimiter='\t'))
for r in full:
 r.update(source_version='unicode-17-full',emoji='false',requires_base=str(r['category'].startswith('M')).lower(),standalone_safe=str(r['category'][0] not in 'MCZ').lower(),script='Armenian' if r['block']=='Armenian' else 'Common',shape_hints='')
seen={r['codepoint'] for r in rows}
rows += [r for r in full if r['codepoint'] not in seen]
conditions=[('几何',8,lambda r:r['block']=='Geometric Shapes'),('数学',8,lambda r:r['block'] in ['Mathematical Operators','Supplemental Mathematical Operators']),('箭头',8,lambda r:'Arrows' in r['block']),('陌生文字',6,lambda r:r['script']=='Armenian')]
selected=[]
for category,count,predicate in conditions:
 candidates=[r for r in rows if predicate(r) and r['emoji']=='false' and r['requires_base']=='false' and r['standalone_safe']=='true']
 for r in candidates:
  cp=int(r['codepoint'][2:],16)
  font=next((n for n,(c,v) in fonts.items() if cp in c),None)
  if not font:continue
  selected.append({'symbol_id':f'u-{cp:04x}','char':r['char'],'codepoint':r['codepoint'],'source_version':r['source_version'],'category':category,'shape_tags':r['shape_hints'].split(','),'font':font,'font_version':fonts[font][1],'font_sha256':hashlib.sha256((p/'public/fonts'/f'{font}-Regular.ttf').read_bytes()).hexdigest()})
  if sum(x['category']==category for x in selected)==count:break
 assert sum(x['category']==category for x in selected)==count,(category,len(candidates))
(p/'src/unicode.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding='utf8')
print(len(selected));print('30 characters covered; fonts pinned by SHA256')


