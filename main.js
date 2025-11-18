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
    const ROTATION_SPEED = 2; // Velocidade de rotação em radianos por segundo
    const JUMP_POWER = 7;
    const GRAVITY = -20;
    let velocityY = 0;
    let isGrounded = true;
    let sphereRotationY = 0; // Ângulo de rotação da esfera
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
    const camera = new BABYLON.FreeCamera("sceneCamera", new BABYLON.Vector3(0, 5, -12), scene); // Cria a câmera livre com posição inicial
    camera.inputs.clear(); // Remove entradas padrão (mouse/teclado) para evitar controle automático
    if (camera.inputs.attached?.mouse) camera.inputs.attached.mouse.detachControl(); // Garante que o mouse não controle a câmera
    if (camera.inputs.attached?.keyboard) camera.inputs.attached.keyboard.detachControl(); // Garante que o teclado não controle a câmera
    camera.inputs.addGamepad(); // Mantém suporte a gamepad (se existir)

    const cameraOffset = new BABYLON.Vector3(0, 6, 15); // Offset da câmera em relação à esfera (x, y, z)
    let cameraCurrentRotation = 0; // Rotação atual da câmera (interpolada)

    // ==================== SETA INDICADORA DE DIREÇÃO ====================
    const arrow = BABYLON.MeshBuilder.CreateCylinder("arrow", { 
        height: 3, 
        diameterTop: 0, 
        diameterBottom: 0.5, 
        tessellation: 3 
    }, scene);
    arrow.rotation.x = Math.PI / 2; // Rotaciona para ficar deitada
    arrow.position.y = 2; // Levemente acima do chão
    
    const arrowMat = new BABYLON.StandardMaterial("arrowMat", scene);
    arrowMat.diffuseColor = new BABYLON.Color3(1, 0.5, 0); // Laranja
    arrowMat.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0); // Brilho
    arrow.material = arrowMat;

    let lastPosition = sphere.position.clone();
    let movementDirection = new BABYLON.Vector3(0, 0, 0);

    // ==================== LOOP PRINCIPAL ====================
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;

        // Rotação da esfera (A e D)
        if (keys.a) sphereRotationY -= ROTATION_SPEED * dt;
        if (keys.d) sphereRotationY += ROTATION_SPEED * dt;

        // Movimento para frente/trás baseado na direção da esfera (W e S)
        if (keys.w) {
            sphere.position.x += Math.sin(sphereRotationY) * MOVE_SPEED * dt;
            sphere.position.z += Math.cos(sphereRotationY) * MOVE_SPEED * dt;
        }
        if (keys.s) {
            sphere.position.x -= Math.sin(sphereRotationY) * MOVE_SPEED * dt;
            sphere.position.z -= Math.cos(sphereRotationY) * MOVE_SPEED * dt;
        }

        // Rolagem realista da bola baseada no movimento
        if (keys.w) {
            sphere.rotation.x += MOVE_SPEED * dt * 2;
        }
        if (keys.s) {
            sphere.rotation.x -= MOVE_SPEED * dt * 2;
        }
        if (keys.a || keys.d) {
            sphere.rotation.z += (keys.a ? -ROTATION_SPEED : ROTATION_SPEED) * dt * 2;
        }

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

        // Atualiza a seta para apontar sempre na direção que a esfera está mirando
        arrow.position.x = sphere.position.x;
        arrow.position.z = sphere.position.z;
        arrow.rotation.y = sphereRotationY;
        arrow.isVisible = true;

        // Câmera segue a direção da seta com movimento suave (alpha + 180°)
        // [DESATIVADO A PEDIDO]: As linhas abaixo realizavam o giro e posicionamento da câmera.
        cameraCurrentRotation = BABYLON.Scalar.Lerp(cameraCurrentRotation, sphereRotationY, 0.5); // Suaviza a rotação da câmera rumo ao ângulo da esfera
        const rotatedOffset = BABYLON.Vector3.TransformCoordinates( // Converte o offset para a rotação atual da câmera
             cameraOffset, // Offset base (atrás e acima da esfera)
             BABYLON.Matrix.RotationY(cameraCurrentRotation + Math.PI) // Soma 180° para ficar atrás da direção apontada
         );
         const targetPos = sphere.position.clone(); // Posição alvo começa na posição da esfera
         targetPos.addInPlace(rotatedOffset); // Soma o offset rotacionado para obter o ponto de câmera desejado
         camera.position = BABYLON.Vector3.Lerp(camera.position, targetPos, 0.1); // Move a câmera suavemente até o alvo
         camera.setTarget(sphere.position); // Faz a câmera olhar para a esfera
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