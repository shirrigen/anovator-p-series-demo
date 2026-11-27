(function(root){
  'use strict';
  const size = 270;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function roundedFace(THREE){
    const a = 40.05, k = 30.4, r = 9.65;
    const face = new THREE.Shape();
    face.moveTo(-k,-a);
    face.lineTo(k,-a);
    face.absarc(k,-k,r,-Math.PI/2,0,false);
    face.lineTo(a,k);
    face.absarc(k,k,r,0,Math.PI/2,false);
    face.lineTo(-k,a);
    face.absarc(-k,k,r,Math.PI/2,Math.PI,false);
    face.lineTo(-a,-k);
    face.absarc(-k,-k,r,Math.PI,1.5*Math.PI,false);
    return face;
  }

  function smooth(from, to, time){
    const fraction = Math.max(0, Math.min(1, (time-from)/(to-from)));
    return fraction*fraction*(3-2*fraction);
  }

  async function create(){
    if(location.protocol==='file:'||new URLSearchParams(location.search).get('renderer')==='css')return null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2',{alpha:true,antialias:true,depth:true,stencil:false,powerPreference:'low-power'});
    if(!context)return null;
    const assets = new URL('assets/three/', document.baseURI);
    const shader = async name=>{
      const response = await fetch(new URL(name,assets));
      if(!response.ok)throw new Error(name+' HTTP '+response.status);
      return response.text();
    };
    const [THREE,vertexShader,fragmentShader] = await Promise.all([
      import(new URL('three.module.js',assets).href), shader('tile.vert'), shader('tile.frag')
    ]);
    const renderer = new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(2, Math.max(1, root.devicePixelRatio||1)));
    renderer.setSize(size,size,false);
    renderer.setClearColor(0x000000,0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-size/2,size/2,size/2,-size/2,1,150);
    camera.position.z = 68;
    const geometry = new THREE.ExtrudeGeometry(roundedFace(THREE), {
      depth:2,bevelEnabled:true,bevelThickness:.7,bevelSize:.83,bevelSegments:5,curveSegments:18,steps:1
    });
    const meshes = Array.from({length:9},(_,index)=>{
      const uniforms = Object.fromEntries(['lit','recorded','press','reflection','checkStroke'].map(name=>[name,{value:0}]));
      const tile = new THREE.Mesh(geometry, new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms}));
      tile.position.set((index%3-1)*94,(1-Math.floor(index/3))*94,0);
      scene.add(tile);
      return tile;
    });

    let frame = null;
    let available = true;
    function stop(){
      if(frame!==null)cancelAnimationFrame(frame);
      frame=null;
    }
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      available=false;
      stop();
      const grid = canvas.closest('.st-react-grid');
      if(grid)grid.dataset.renderer='css';
      canvas.remove();
    });

    function mount(grid, {phase,target}, phaseSince){
      if(!available)return;
      stop();
      grid.querySelector('.st-react-surface').append(canvas);
      grid.dataset.renderer='three';
      grid.dataset.threeRevision=THREE.REVISION;
      const receipt = grid.parentElement.querySelector('.st-react-receipt');
      const direct = document.documentElement.classList.contains('direct-navigation');
      const draw = age=>{
        const elapsed = motion.matches?360:age;
        const pressed = smooth(0,60,elapsed)*(1-smooth(60,250,elapsed));
        meshes.forEach((tile,index)=>{
          const recorded = phase==='receipt'&&target===index;
          const u = tile.material.uniforms;
          u.lit.value=phase==='lit'&&target===index?1:0;
          u.recorded.value=recorded?1:0;
          u.press.value=recorded?pressed:0;
          u.reflection.value=recorded?1-smooth(0,265,elapsed):0;
          u.checkStroke.value=recorded?smooth(36,156,elapsed):0;
          tile.position.z=recorded?-1.05*pressed:0;
        });
        if(phase==='receipt'&&!direct)receipt.style.opacity=String(smooth(52,175,elapsed));
        renderer.render(scene,camera);
      };
      const tick = time=>{
        if(!grid.isConnected){frame=null;return;}
        draw(Math.max(0,time-phaseSince));
        frame = time-phaseSince<360&&!motion.matches?requestAnimationFrame(tick):null;
      };
      if(phase==='receipt'&&!motion.matches)tick(performance.now());
      else draw(360);
    }
    return {mount,stop};
  }

  root.ANOVATOR_REACTION_RENDERER={create};
})(globalThis);
