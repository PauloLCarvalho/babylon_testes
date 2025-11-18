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
    
    // Luz direcional adicional para melhor iluminação do modelo
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.intensity = 0.5;

    // ==================== MODELO 3D CONTROLÁVEL ====================
    let sphere = BABYLON.MeshBuilder.CreateSphere("tempSphere", { diameter: 2 }, scene);
    sphere.position.y = 1;
    sphere.isVisible = false; // Invisível até o modelo carregar

    // Carregar modelo do leão
    BABYLON.SceneLoader.ImportMesh("", "./source/", "godzilla_first_walk_animationscrunchy32205_alt.glb", scene, function (meshes) {
        console.log("Modelo do Godzilla carregado com sucesso!");
        
        if (meshes.length > 0) {
            // Remove a esfera temporária
            sphere.dispose();
            
            // Usa o modelo carregado
            sphere = meshes[0];
            sphere.position.y = 1;
            
            // Ajustar escala - Godzilla TAMANHO
            sphere.scaling = new BABYLON.Vector3(0.007, 0.007, 0.007); 
        }
    }, null, function (scene, message) {
        console.error("Erro ao carregar modelo:", message);
        // Torna a esfera temporária visível como fallback
        sphere.isVisible = true;
    });

    const MOVE_SPEED = 4;
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

    // ==================== TIROS / PROJÉTEIS ====================
    const PROJECTILE_SPEED = 55;
    const FIRE_COOLDOWN = 0.1; // segundos entre disparos ao segurar
    const PROJECTILE_LIFETIME = 2; // segundos
    const PROJECTILE_SIZE = 0.1;
    let isFiring = false;
    let fireCooldownTimer = 0;
    const projectiles = [];

    // Usa eventos de ponteiro do Babylon na própria cena (mais confiável que window)
    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button === 0) isFiring = true;
        } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
            if (pointerInfo.event.button === 0) isFiring = false;
        }
    });

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

        // Disparo contínuo com cooldown
        fireCooldownTimer -= dt;
        if (isFiring && fireCooldownTimer <= 0) {
            fireCooldownTimer = FIRE_COOLDOWN;
            const yaw = sphereRotationY;
            const dir = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
            const spawnPos = new BABYLON.Vector3(
                sphere.position.x + dir.x * 1.8,
                2,
                sphere.position.z + dir.z * 1.8
            );
            const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: PROJECTILE_SIZE * 2 }, scene);
            bullet.position.copyFrom(spawnPos);
            const bmat = new BABYLON.StandardMaterial("bulletMat", scene);
            bmat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.2);
            bullet.material = bmat;
            projectiles.push({ mesh: bullet, dir: dir, age: 0 });
        }

        // Atualiza projéteis + colisão com caixas
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.mesh.position.addInPlace(p.dir.scale(PROJECTILE_SPEED * dt));

            // Colisão com caixas (bounding boxes)
            let collided = false;
            for (let b = boxes.length - 1; b >= 0; b--) {
                const box = boxes[b];
                if (p.mesh.intersectsMesh(box, false)) {
                    // Remove a caixa da lista e inicia animação de quebra
                    boxes.splice(b, 1);
                    breakBox(box);
                    collided = true;
                    break;
                }
            }

            if (collided) {
                p.mesh.dispose();
                projectiles.splice(i, 1);
                continue;
            }

            // Tempo de vida
            p.age += dt;
            if (p.age >= PROJECTILE_LIFETIME) {
                p.mesh.dispose();
                projectiles.splice(i, 1);
            }
        }

        // Atualiza a seta para apontar sempre na direção que a esfera está mirando
        arrow.position.x = sphere.position.x;
        arrow.position.z = sphere.position.z;
        arrow.rotation.y = sphereRotationY;
        arrow.isVisible = true;

        // Mantém o alpha (yaw) da esfera igual ao da seta
        sphere.rotation.y = arrow.rotation.y;

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
    groundMat.diffuseTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/grass.png", scene);
    groundMat.diffuseTexture.uScale = 20; // Repetição horizontal (ajuste conforme necessário para melhor tiling)
    groundMat.diffuseTexture.vScale = 20; // Repetição vertical
    groundMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // Cor branca para preservar as cores da textura
    groundMat.wireframe = false; // Desativa wireframe para ver a textura claramente (ative se quiser debug)
    ground.material = groundMat;

    // Mantém referência às caixas para colisões
    const boxes = [];

    // Anima e remove uma caixa quando atingida por projétil
    const breakBox = (box) => {
        if (!box || box._breaking) return;
        box._breaking = true;
        const anim = new BABYLON.Animation(
            "shrink",
            "scaling",
            60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        anim.setKeys([
            { frame: 0, value: box.scaling.clone() },
            { frame: 12, value: new BABYLON.Vector3(0, 0, 0) }
        ]);
        box.animations = [anim];
        scene.beginAnimation(box, 0, 12, false, 1.5, () => {
            box.dispose();
        });
    };

    const createBox = (x, z, color) => {
        const box = BABYLON.MeshBuilder.CreateBox("box", { size: 2 }, scene);
        box.position.set(x, 1, z);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.diffuseColor = color;
        box.material = mat;
        boxes.push(box);
        return box;
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