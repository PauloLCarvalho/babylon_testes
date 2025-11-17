const canvas = document.createElement("canvas");
canvas.style.width = "100vw";
canvas.style.height = "100vh";
canvas.style.display = "block";
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(canvas);

const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.5, 0.8, 0.9, 1);

    // Luz
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.9;

    // ==================== ESFERA CONTROLÁVEL ====================
    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
    sphere.position.y = 1;

    const MOVE_SPEED = 8;
    const JUMP_POWER = 7;
    const GRAVITY = -20;
    let velocityY = 0;
    let isGrounded = true;
    const keys = { w: false, a: false, s: false, d: false };

    window.addEventListener("keydown", e => {
        const k = e.key.toLowerCase();
        if (k in keys) keys[k] = true;
        if (k === " " && isGrounded) { velocityY = JUMP_POWER; isGrounded = false; }
    });
    window.addEventListener("keyup", e => {
        const k = e.key.toLowerCase();
        if (k in keys) keys[k] = false;
    });

    // ==================== CÂMERA THIRD-PERSON PERFEITA ====================
    const camera = new BABYLON.FreeCamera("sceneCamera", new BABYLON.Vector3(0, 5, -12), scene);
    camera.inputs.clear();
    if (camera.inputs.attached?.mouse) camera.inputs.attached.mouse.detachControl();
    if (camera.inputs.attached?.keyboard) camera.inputs.attached.keyboard.detachControl();
    camera.inputs.addGamepad();

    const cameraOffset = new BABYLON.Vector3(0, 4, 12);
    let cameraTargetRotation = 0;
    let isRotatingCamera = false;

    scene.onPointerObservable.add((evt) => {
        if (evt.type === BABYLON.PointerEventTypes.POINTERDOWN && evt.event.button === 2) {
            isRotatingCamera = true;
            canvas.style.cursor = "grabbing";
        }
        if (evt.type === BABYLON.PointerEventTypes.POINTERUP || evt.type === BABYLON.PointerEventTypes.POINTEROUT) {
            isRotatingCamera = false;
            canvas.style.cursor = "default";
        }
        if (isRotatingCamera && evt.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            cameraTargetRotation += evt.event.movementX * 0.008;
        }
    });

    // ==================== LOOP PRINCIPAL ====================
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;

        // Movimento da esfera
        if (keys.w) sphere.position.z -= MOVE_SPEED * dt;
        if (keys.s) sphere.position.z += MOVE_SPEED * dt;
        if (keys.a) sphere.position.x += MOVE_SPEED * dt;
        if (keys.d) sphere.position.x -= MOVE_SPEED * dt;

        // Rolagem realista da bola
        if (keys.w) sphere.rotation.x += MOVE_SPEED * dt * 2;
        if (keys.s) sphere.rotation.x -= MOVE_SPEED * dt * 2;
        if (keys.a) sphere.rotation.z -= MOVE_SPEED * dt * 2;
        if (keys.d) sphere.rotation.z += MOVE_SPEED * dt * 2;

        // Gravidade e pulo
        if (!isGrounded) {
            velocityY += GRAVITY * dt;
            sphere.position.y += velocityY * dt;
        }
        if (sphere.position.y <= 1) {
            sphere.position.y = 1;
            velocityY = 0;
            isGrounded = true;
        }

        // Câmera segue suavemente com rotação
        const rotatedOffset = BABYLON.Vector3.TransformCoordinates(cameraOffset, BABYLON.Matrix.RotationY(cameraTargetRotation));
        const targetPos = sphere.position.clone();
        targetPos.addInPlace(rotatedOffset);
        camera.position = BABYLON.Vector3.Lerp(camera.position, targetPos, 0.1);
        camera.setTarget(sphere.position);
    });

    // ==================== CHÃO E CAIXAS DE REFERÊNCIA ====================
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    groundMat.wireframe = true;
    ground.material = groundMat;

    const createBox = (x, z, color) => {
        const box = BABYLON.MeshBuilder.CreateBox("box", { size: 2 }, scene);
        box.position.set(x, 1, z);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.diffuseColor = color;
        box.material = mat;
    };

    createBox(5, 0,   new BABYLON.Color3(1, 0, 0));   // vermelho
    createBox(0, 5,   new BABYLON.Color3(0, 1, 0));   // verde
    createBox(-5, 0,  new BABYLON.Color3(0, 0, 1));   // azul
    createBox(0, -5,  new BABYLON.Color3(1, 1, 0));   // amarelo

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());