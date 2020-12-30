import * as BABYLON from "babylonjs";
import { AbstractMesh } from "babylonjs";

// Get the canvas DOM element
var canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

// Load the 3D engine
var engine: BABYLON.Engine;

// -------------------------------------------------------------------------------
// createDefaultEngine
// -------------------------------------------------------------------------------
var createDefaultEngine = function () {
  return new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
};

// -------------------------------------------------------------------------------
// Create scene
// -------------------------------------------------------------------------------
var createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera(
        "camera1",
        new BABYLON.Vector3(0, 5, -10),
        scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // Add a light
    var light = new BABYLON.HemisphericLight(
        "light1",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = 0.7;

    // Add an object
    var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene);
    sphere.position.y = 1;
       
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
const giddyUp = async function () {
    engine = createDefaultEngine();
    if (!engine) throw "Unable to create an engine!";

    const sceneToRender = await createScene();
    if(!sceneToRender) throw "Unable to create a scene!";

    // Add a handler for Resize
    window.addEventListener("resize", () => { engine.resize(); });
    engine.runRenderLoop(() => sceneToRender.render())
}

giddyUp();

