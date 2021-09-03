import * as BABYLON from "babylonjs";
import { AbstractMesh } from "babylonjs";
//const perlinNoise3d = require('perlin-noise-3d');
import perlinNoise3d from "./perlin";
//const perlinNoise3d = require('./perlin');
const noise = new perlinNoise3d(16);
noise.noiseSeed(.3);

// Some global handles for graphics
const theCanvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(
    theCanvas, 
    true, 
    {
        preserveDrawingBuffer: true,
        stencil: true,
    });

if (!engine) throw "Unable to create an engine!";


// -------------------------------------------------------------------------------
// Create scene
// -------------------------------------------------------------------------------
var createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.UniversalCamera(
        "camera1",
        new BABYLON.Vector3(0, 125, -150),
        scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(theCanvas, true);

    // Add a light
    var light = new BABYLON.HemisphericLight(
        "light1",
        new BABYLON.Vector3(0, 2000, 2000),
        scene
    );
    light.intensity = 0.7;

    // Add an object
    var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 10, scene);
    sphere.position.y = -4;

    // Add a landscape
    //const points:{x: Number; y: Number; z: number}[][] = [];
    const positions = new Array<number>();
    const indices = new Array<number>();
    const size = 500;
    const noiseScale = size/8;
    const indexShift = Math.floor(size/2);
    let min = 1;
    let max = 0;
    let drop = 0.5;
    let lowAltitude = 0.45;
    for(let z = 0; z< size; z++)
    {
        //const xArray = new Array<{x: Number; y: Number; z: number}>();
        for(let x =0; x< size; x++)
        {
            // const amp = 5 + 5 * Math.sin(z/25.0 * Math.PI)
            // const y = 0 + amp * Math.sin(x/25.0 * Math.PI);

            const nx = x/noiseScale;
            const nz = z/noiseScale;
        
            let noiseValue = noise.get(nx,nz);

            if(noiseValue < min) min = noiseValue;
            if(noiseValue > max) max = noiseValue;

            if(noiseValue < lowAltitude) {
                const off = (lowAltitude - noiseValue);
                noiseValue += off * .90;
            }

            noiseValue -= drop;

            const y = 200 * noiseValue;
            //xArray.push({x,y,z})
            positions.push(...[x-indexShift,y,z-indexShift]);
            if(z < size-1 && x < size-1) {
                const p = z * size + x;
                // two triangles to represent this square in the grid
                indices.push(...[ p,p+1,p+size ,  p+size, p+1, p+size+1]);
            }
        }
        //points.push(xArray);
    }
    console.log( `${min} = ${max}`)
    var customMesh = new BABYLON.Mesh("custom", scene);
    // var positions = [-5, 2, -3, -7, -2, -3, -3, -2, -3, 5, 2, 3, 7, -2, 3, 3, -2, 3];
    // var indices = [0, 1, 2, 3, 4, 5];
        
    var vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;   
    vertexData.applyToMesh(customMesh);
    var landscapeMaterial = new BABYLON.StandardMaterial("landscapeMaterial", scene);
    landscapeMaterial.diffuseColor = new BABYLON.Color3(242/255,151/255,60/255);
    landscapeMaterial.specularColor = new BABYLON.Color3(0,0,0);
    customMesh.material = landscapeMaterial;

       
    const env = scene.createDefaultEnvironment();
    if(!env) return null;

    await scene.createDefaultXRExperienceAsync({
        floorMeshes: [env.ground as AbstractMesh],
    });

    window.addEventListener("wheel", event => {
        const delta = new BABYLON.Vector3(0, 125, -150).scale(event.deltaY / 5000.0);
        camera.position = camera.position.add(delta);
        console.info(event.deltaY)
    });

    // Enable VR
    var vrHelper = scene.createDefaultVRExperience();
    vrHelper.enableInteractions();
    return scene;
};

// -------------------------------------------------------------------------------
// Run the game
// -------------------------------------------------------------------------------
(async function () {
    const sceneToRender = await createScene();
    if(!sceneToRender) throw "Unable to create a scene!";

    window.addEventListener("resize", () => { engine.resize(); });
    engine.runRenderLoop(() => sceneToRender.render())
})()

