import * as BABYLON from "babylonjs";
import { AbstractMesh } from "babylonjs";
const perlinNoise3d = require('perlin-noise-3d');
const noise = new perlinNoise3d();
noise.noiseSeed(1);

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
    var camera = new BABYLON.FreeCamera(
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
    var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene);
    sphere.position.y = 20;

    // Add a landscape
    //const points:{x: Number; y: Number; z: number}[][] = [];
    const positions = new Array<number>();
    const indices = new Array<number>();
    const size = 1500;
    const noiseScale = size/.5;
    for(let z = 0; z< size; z++)
    {
        //const xArray = new Array<{x: Number; y: Number; z: number}>();
        for(let x =0; x< size; x++)
        {
            // const amp = 5 + 5 * Math.sin(z/25.0 * Math.PI)
            // const y = 0 + amp * Math.sin(x/25.0 * Math.PI);

            const nx = x/noiseScale;
            const nz = z/noiseScale;
        
            let noiseValue = noise.get(nx,0,nz);
            for(let octave = 2; octave <= 32; octave *= 2)
            {
                noiseValue += noise.get(nx * octave,0, nz * octave) / octave;
            }

            const y = 500 * noiseValue - 400;
            //xArray.push({x,y,z})
            positions.push(...[x-size/2,y,z-size/2]);
            if(z < size-1 && x < size-1) {
                const p = z * size + x;
                // two triangles to represent this square in the grid
                indices.push(...[p,p+1,p+size,  p+size, p+1, p+size+1]);
            }
        }
        //points.push(xArray);
    }
    var customMesh = new BABYLON.Mesh("custom", scene);
    // var positions = [-5, 2, -3, -7, -2, -3, -3, -2, -3, 5, 2, 3, 7, -2, 3, 3, -2, 3];
    // var indices = [0, 1, 2, 3, 4, 5];
        
    var vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;   
    vertexData.applyToMesh(customMesh);

       
    const env = scene.createDefaultEnvironment();
    if(!env) return null;

    await scene.createDefaultXRExperienceAsync({
        floorMeshes: [env.ground as AbstractMesh],
    });

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

