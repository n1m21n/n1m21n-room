import sys,os
from PIL import Image
ST=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../build-cache/review/stills/')
names=sys.argv[2:]; out=sys.argv[1]
W,H=640,360; cols=2; rows=(len(names)+1)//2
im=Image.new('RGB',(cols*W,rows*H))
for i,n in enumerate(names): im.paste(Image.open(ST+f'epm-{n}.png').convert('RGB').resize((W,H)),((i%cols)*W,(i//cols)*H))
im.save(out)
