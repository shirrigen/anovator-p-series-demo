import {
  AgXToneMapping, Color, Mesh, PerspectiveCamera, Quaternion, RectAreaLight,
  Scene, ShaderChunk, Vector3, WebGLRenderer,
} from './assets/three/three.module.js';
import {GLTFLoader} from './assets/three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from './assets/three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from './assets/three/addons/libs/meshopt_decoder.module.js';
import {RectAreaLightUniformsLib} from './assets/three/addons/lights/RectAreaLightUniformsLib.js';

const FRAME_WIDTH=360;
const FRAME_HEIGHT=503;
const OVERVIEW_IMAGE={left:41,top:22,width:280};
const stageUrl=new URL('./assets/home-camera-motion-v01/stage.json',import.meta.url);
const stillsUrl=new URL('./assets/home-camera-static-v01/views.json',import.meta.url);
const radians=degrees=>degrees*Math.PI/180;
const mix=(a,b,t)=>a+(b-a)*t;
const yUp=([x,y,z])=>new Vector3(x,z,-y);
const zUpToYUp=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);

async function jsonAt(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error('Home camera asset '+response.status);
  return response.json();
}

async function loadBody(stage){
  const bundle=await jsonAt(new URL(stage.model,stageUrl));
  const bytes=Uint8Array.from(atob(bundle.gzip),character=>character.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const gltf=await new Response(stream).text();
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const asset=await loader.parseAsync(gltf,new URL('.',stageUrl).href);
  return combineBody(asset.scene);
}

function overviewPose(source){
  const imageHeight=OVERVIEW_IMAGE.width*source.sourceSize[1]/source.sourceSize[0];
  const halfHeight=Math.tan(radians(source.verticalFovDegrees)/2);
  return {
    ...source,
    verticalFovDegrees:2*Math.atan(halfHeight*FRAME_HEIGHT/imageHeight)*180/Math.PI,
    screenAnchor:[
      (OVERVIEW_IMAGE.left+source.screenAnchor[0]*OVERVIEW_IMAGE.width)/FRAME_WIDTH,
      (OVERVIEW_IMAGE.top+source.screenAnchor[1]*imageHeight)/FRAME_HEIGHT,
    ],
  };
}

function cameraPose(shot){
  return {
    target:yUp(shot.target),
    yaw:radians(shot.yaw),
    elevation:radians(shot.elevation),
    distance:shot.distance,
    fov:shot.verticalFovDegrees,
    anchor:shot.screenAnchor,
  };
}

function cameraMove(from,to){
  const yawDelta=((to.yaw-from.yaw+3*Math.PI)%(2*Math.PI))-Math.PI;
  const turn=Math.abs(yawDelta);
  const travel=from.target.distanceTo(to.target);
  const zoom=Math.abs(Math.log(to.distance/from.distance));
  const duration=Math.min(710,300+110*turn+142*travel+74*zoom);
  const pullback=.22*Math.min(1,Math.max(0,(turn-.85)/1.25,(travel-.44)/1.1));
  return {from,to,yawDelta,duration,pullback,elapsed:0};
}

function poseAt(move,phase){
  const t=phase*phase*phase*(phase*(phase*6-15)+10);
  const {from,to}=move;
  // Let the viewer recover the body's outline while travelling a long way.
  const lift=1+move.pullback*Math.sin(Math.PI*t)**2;
  return {
    target:from.target.clone().lerp(to.target,t),
    yaw:from.yaw+move.yawDelta*t,
    elevation:mix(from.elevation,to.elevation,t),
    distance:Math.exp(mix(Math.log(from.distance),Math.log(to.distance),t))*lift,
    fov:mix(from.fov,to.fov,t),
    anchor:from.anchor.map((value,index)=>mix(value,to.anchor[index],t)),
  };
}

function place(camera,pose){
  const {target,yaw,elevation,distance,fov,anchor}=pose;
  const horizontal=Math.cos(elevation);
  camera.position.set(Math.sin(yaw)*horizontal,Math.sin(elevation),Math.cos(yaw)*horizontal);
  camera.position.multiplyScalar(distance).add(target);
  camera.lookAt(target);
  camera.fov=fov;
  camera.updateProjectionMatrix();
  // Lens shift moves the composition without changing the target or field of view.
  camera.projectionMatrix.elements[8]=1-2*anchor[0];
  camera.projectionMatrix.elements[9]=2*anchor[1]-1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

function combineBody(source){
  const pieces=[];
  source.updateMatrixWorld(true);
  source.traverse(node=>{if(node.isMesh)pieces.push(node);});
  if(!pieces.length)throw new Error('The MO stage is empty.');
  const material=pieces[0].material;
  if(!pieces.every(piece=>piece.material===material))return source;
  const geometries=pieces.map(piece=>piece.geometry.clone().applyMatrix4(piece.matrixWorld));
  const merged=mergeGeometries(geometries);
  for(const geometry of geometries)geometry.dispose();
  return merged?new Mesh(merged,material):source;
}

function lightAt(source){
  const light=new RectAreaLight(new Color().fromArray(source.color),1,...source.size);
  const [w,x,y,z]=source.orientationWxyz;
  light.name=source.name;
  light.position.copy(yUp(source.position));
  light.quaternion.copy(zUpToYUp).multiply(new Quaternion(x,y,z,w));
  light.power=source.power;
  return light;
}

function matchStageContrast(body){
  const materials=new Map();
  body.traverse(node=>{if(node.isMesh)materials.set(node.material,!!node.geometry.getAttribute('_mo_visibility'));});
  for(const [material,hasVisibility] of materials){
    material.onBeforeCompile=shader=>{
      if(hasVisibility){
        shader.vertexShader='attribute vec4 _mo_visibility; varying vec4 moVisibility;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmoVisibility = _mo_visibility;');
        shader.fragmentShader='varying vec4 moVisibility;\n'+shader.fragmentShader;
        const lighting=ShaderChunk.lights_fragment_begin.replace(
          'rectAreaLight = rectAreaLights[ i ];',
          'rectAreaLight = rectAreaLights[ i ];\nrectAreaLight.color *= mix( 0.09, 1.0, moVisibility[ i ] );',
        );
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lighting);
      }
      // Bring AgX's display values closer to the P02 reference's contrast.
      const toe=hasVisibility?'0.15':'0.215';
      const contrast=hasVisibility?'1.38':'1.48';
      shader.fragmentShader=shader.fragmentShader.replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
        float moValue = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float moGrade = max(0.0, (moValue - ${toe}) * ${contrast});
        gl_FragColor.rgb *= moGrade / max(0.0001, moValue);`,
      );
    };
  }
}

async function loadWorld(canvas){
  const context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!context)throw new Error('WebGL2 is unavailable.');
  const graphicsInfo=context.getExtension('WEBGL_debug_renderer_info');
  const adapter=graphicsInfo?context.getParameter(graphicsInfo.UNMASKED_RENDERER_WEBGL):'';
  const software=/SwiftShader|llvmpipe|Software/i.test(adapter);
  const [stage,views]=await Promise.all([jsonAt(stageUrl),jsonAt(stillsUrl)]);
  if(stage.sourceSha256!==views.sourceSha256)throw new Error('Home camera sources disagree.');
  const scene=new Scene();
  scene.name=stage.sourceScene;
  scene.background=new Color(0);
  const body=await loadBody(stage);
  matchStageContrast(body);
  scene.add(body,...stage.lights.map(lightAt));
  RectAreaLightUniformsLib.init();
  const renderer=new WebGLRenderer({canvas,context,alpha:false,antialias:true});
  renderer.toneMapping=AgXToneMapping;
  renderer.toneMappingExposure=2**stage.exposureStops;
  const camera=new PerspectiveCamera(30,FRAME_WIDTH/FRAME_HEIGHT,.045,30);
  const shots={...views.shots,overview:overviewPose(stage.overview)};
  const poses=Object.fromEntries(Object.entries(shots).map(([id,shot])=>[id,cameraPose(shot)]));
  return {scene,body,renderer,camera,poses,stage,adapter,software};
}

export function createHomeCamera(){
  const canvas=document.createElement('canvas');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  let world=null,loading=null,slot=null,covered=false,failed=false,lost=false;
  let selected=null,presented=null,pose=null,move=null,raf=null,lastFrame=null,width=0,drawn=0;

  function displayState(state){
    if(!slot)return;
    slot.dataset.cameraState=state;
    slot.parentElement.classList.toggle('hub-camera-ready',state==='ready');
  }

  function stopFrames(){
    if(raf!==null)cancelAnimationFrame(raf);
    raf=lastFrame=null;
  }

  function show(){
    if(raf!==null||!slot?.isConnected||covered||document.hidden||!world||lost||failed)return;
    raf=requestAnimationFrame(draw);
  }

  function draw(now){
    raf=null;
    if(!slot?.isConnected||covered||!world||lost||failed)return;
    if(move){
      if(lastFrame!==null)move.elapsed+=Math.min(90,Math.max(0,now-lastFrame));
      const phase=Math.min(1,move.elapsed/move.duration);
      pose=phase===1?move.to:poseAt(move,phase);
      if(phase===1)move=null;
    }
    lastFrame=now;
    const sampling=world.software?1:Math.max(1.45,Math.min(devicePixelRatio,1.8));
    const preferredWidth=slot.getBoundingClientRect().width*sampling;
    const drawWidth=Math.round(Math.max(FRAME_WIDTH,Math.min(1080,preferredWidth)));
    if(width!==drawWidth){
      width=drawWidth;
      world.renderer.setSize(width,Math.round(width*FRAME_HEIGHT/FRAME_WIDTH),false);
    }
    place(world.camera,pose);
    world.renderer.render(world.scene,world.camera);
    presented=selected;
    drawn++;
    displayState('ready');
    if(move)show();
  }

  function select(id){
    if(!world||!world.poses[id]||id===selected)return;
    const next=world.poses[id];
    selected=id;
    move=pose&&!reduce.matches?cameraMove(pose,next):null;
    if(!move)pose=next;
    lastFrame=null;
  }

  function attach(nextSlot,occluded=false){
    slot=nextSlot;
    covered=occluded;
    if(!slot){
      stopFrames();
      return;
    }
    if(failed||lost){
      displayState('fallback');
      return;
    }
    if(!world){
      displayState('loading');
      if(!loading){
        loading=loadWorld(canvas).then(loaded=>{
          world=loaded;
          attach(slot,covered);
        }).catch(()=>{
          failed=true;
          stopFrames();
          displayState('fallback');
        });
      }
      return;
    }
    if(canvas.parentElement!==slot)slot.appendChild(canvas);
    if(drawn)displayState('ready');
    select(slot.dataset.homeCamera);
    if(covered)stopFrames();
    else show();
  }

  function cover(occluded){
    if(covered===occluded)return;
    covered=occluded;
    if(covered)stopFrames();
    else show();
  }

  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    lost=true;
    stopFrames();
    displayState('fallback');
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    lost=false;
    width=0;
    attach(slot,covered);
  });
  window.addEventListener('resize',show);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopFrames();
    else show();
  });
  reduce.addEventListener('change',()=>{
    if(reduce.matches&&move){pose=move.to;move=null;}
    show();
  });

  function snapshot(){
    return {
      status:slot?.dataset.cameraState??'detached',
      scene:world?.scene.uuid??null,
      body:world?.body.uuid??null,
      bodyTransform:world?.body.matrixWorld.toArray()??null,
      source:world?.stage.sourceSha256??null,
      parts:world?.stage.meshCount??0,
      selected,
      presented,
      moving:!!move,
      covered,
      reducedMotion:reduce.matches,
      elapsed:move?.elapsed??0,
      duration:move?.duration??0,
      position:world?.camera.position.toArray()??null,
      target:pose?.target.toArray()??null,
      anchor:pose?.anchor??null,
      fov:pose?.fov??null,
      drawn,
      triangles:world?.renderer.info.render.triangles??0,
      adapter:world?.adapter??null,
    };
  }
  return {attach,cover,snapshot};
}
