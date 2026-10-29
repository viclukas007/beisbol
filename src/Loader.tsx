import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
// Pantalla de carga: una pelota de sóftbol girando sobre el diamante, dibujada con three.js.
// Costura de la pelota como curva paramétrica (dos vueltas sobre la esfera).
class SeamCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private radius:number,private a=0.4){super();}
  getPoint(u:number,target=new THREE.Vector3()) {
    const t=u*4*Math.PI,phi=Math.PI/2-(Math.PI/2-this.a)*Math.cos(t),theta=t/2+this.a*Math.sin(2*t);
    return target.set(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)).multiplyScalar(this.radius);
  }
}
export default function Loader({message}:{message:string}) {
  const mount=useRef<HTMLDivElement>(null);
  const [logo,setLogo]=useState(true);
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    const size=()=>{const s=Math.min(host.clientWidth,260);renderer.setSize(s,s,false);};
    size();host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(32,1,0.1,20);camera.position.set(0,1.1,4.2);camera.lookAt(0,0.15,0);
    scene.add(new THREE.HemisphereLight(0xf2f5ee,0x1d3a2a,1.4));
    const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(2.5,3,2.5);scene.add(key);
    const rim=new THREE.DirectionalLight(0xc6e3a6,0.8);rim.position.set(-2,1,-2);scene.add(rim);
    const ball=new THREE.Group();
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshStandardMaterial({color:0xf3f1e6,roughness:0.55,metalness:0})));
    ball.add(new THREE.Mesh(new THREE.TubeGeometry(new SeamCurve(1.005),720,0.035,8,false),new THREE.MeshStandardMaterial({color:0xc8322e,roughness:0.6})));
    // Puntadas: pequeños segmentos perpendiculares a la costura.
    const seam=new SeamCurve(1.012),stitches=new THREE.Group(),stitchGeometry=new THREE.CylinderGeometry(0.012,0.012,0.11,6),stitchMaterial=new THREE.MeshStandardMaterial({color:0xc8322e,roughness:0.6});
    for(let i=0;i<216;i++){const u=i/216,point=seam.getPoint(u),tangent=seam.getTangent(u),normal=point.clone().normalize(),side=new THREE.Vector3().crossVectors(tangent,normal).normalize();const stitch=new THREE.Mesh(stitchGeometry,stitchMaterial);stitch.position.copy(point);stitch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),side);stitch.rotateOnWorldAxis(normal,(i%2?1:-1)*0.6);stitches.add(stitch);}
    ball.add(stitches);ball.position.y=0.15;scene.add(ball);
    // Diamante del campo bajo la pelota.
    const diamond=new THREE.Mesh(new THREE.RingGeometry(1.25,1.32,4,1),new THREE.MeshBasicMaterial({color:0xd9e8b6,transparent:true,opacity:0.55,side:THREE.DoubleSide}));
    diamond.rotation.x=-Math.PI/2;diamond.rotation.z=Math.PI/4;diamond.position.y=-1.05;scene.add(diamond);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.85,48),new THREE.MeshBasicMaterial({color:0x0b1f15,transparent:true,opacity:0.45}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.04;scene.add(shadow);
    let frame=0;const clock=new THREE.Clock();
    const tick=()=>{const t=clock.getElapsedTime();ball.rotation.y=t*0.9;ball.rotation.x=0.35+Math.sin(t*0.7)*0.12;ball.position.y=0.15+Math.sin(t*2.1)*0.08;shadow.scale.setScalar(1-Math.sin(t*2.1)*0.06);renderer.render(scene,camera);if(!reduced)frame=requestAnimationFrame(tick);};
    tick();
    const observer=new ResizeObserver(size);observer.observe(host);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});host.removeChild(renderer.domElement);};
  },[]);
  return <div className="loading-screen loader-3d" role="status" aria-live="polite"><div className="loader-canvas" ref={mount} aria-hidden="true"/>{logo?<img className="loader-logo" src="/league-logo.png" alt="Liga de Sóftbol" onError={()=>setLogo(false)}/>:<h1>Diamante</h1>}<p>{message}</p></div>;
}
