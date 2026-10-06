import {Camera,Color,director,ImageAsset,resources,TextureCube} from 'cc';

export class EngineCoastalSky {
 readonly report={status:'准备海岸天空',faces:0,size:0,far:0,enabled:false,error:''};
 private cube:TextureCube|null=null;private disposed=false;
 constructor(private camera:Camera){
  // The existing source GLB already contains beach, palms, towers and ocean.
  // Its farthest coastal geometry lies beyond the former 240 m camera range.
  camera.far=900;camera.clearColor=new Color(197,225,233);this.report.far=camera.far;
 }
 async prepare(){
  const names=['right','left','top','bottom','front','back'] as const;
  try{
   const images=await Promise.all(names.map(name=>new Promise<ImageAsset>((resolve,reject)=>resources.load('coastal-sky/'+name,ImageAsset,(error,image)=>error?reject(error):resolve(image)))));
   if(this.disposed)return;
   if(images.some(image=>image.width!==256||image.height!==256))throw Error('天空资源尺寸不一致');
   const cube=new TextureCube();cube.name='海岸晴天天空';cube.mipmaps=[{right:images[0],left:images[1],top:images[2],bottom:images[3],front:images[4],back:images[5]}];this.cube=cube;
   const sky=director.getScene()!.globals.skybox;sky.envmap=cube;sky.useIBL=false;sky.enabled=true;this.camera.clearFlags=Camera.ClearFlag.SKYBOX;
   Object.assign(this.report,{status:'海岸天空已加载',faces:images.length,size:images[0].width,enabled:sky.enabled});
  }catch(error){if(!this.disposed){this.report.status='天空加载失败，使用晴天底色';this.report.error=String(error);console.warn(this.report.status,this.report.error);}}
 }
 dispose(){this.disposed=true;const sky=director.getScene()?.globals.skybox;if(sky?.envmap===this.cube){sky.enabled=false;sky.envmap=null;}this.cube?.destroy();this.cube=null;}
}
