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
    let godzilla = BABYLON.MeshBuilder.CreateSphere("tempSphere", { diameter: 2 }, scene);
    godzilla.position.y = 0;
    godzilla.isVisible = false; // Invisível até o modelo carregar
    let godzillaLoaded = false; // Flag para saber se o modelo foi carregado

    // Carregar modelo do Godzilla
    BABYLON.SceneLoader.ImportMesh("", "./source/", "godzilla_first_walk_animationscrunchy32205_alt.glb", scene, function (meshes, particleSystems, skeletons, animationGroups) {
        console.log("Modelo do Godzilla carregado com sucesso!");
        console.log("Número de meshes:", meshes.length);
        console.log("Número de animações:", animationGroups.length);
        
        if (meshes.length > 0) {
            // Remove a esfera temporária
            godzilla.dispose();
            
            // Usa o root mesh ou cria um container
            if (meshes[0].name === "__root__" || meshes.length > 1) {
                // Se há múltiplos meshes, usa o root ou cria um TransformNode
                godzilla = meshes[0];
            } else {
                godzilla = meshes[0];
            }
            
            godzilla.position.y = 0;
            
            // Ajustar escala - Godzilla TAMANHO
            godzilla.scaling = new BABYLON.Vector3(0.007, 0.007, 0.007);
            
            // Resetar rotação inicial do modelo
            godzilla.rotation = new BABYLON.Vector3(0, 0, 0);
            
            // Guardar as animações
            godzilla.animationGroups = animationGroups;
            
            // Parar todas as animações inicialmente
            animationGroups.forEach(ag => {
                ag.stop();
                console.log("Animação encontrada:", ag.name);
            });
            
            godzillaLoaded = true;
            console.log("Godzilla configurado:", godzilla.name);
        }
    }, null, function (scene, message) {
        console.error("Erro ao carregar modelo:", message);
        // Torna a esfera temporária visível como fallback
        godzilla.isVisible = true;
        godzillaLoaded = true;
    });

    const MOVE_SPEED = 4;
    const ROTATION_SPEED = 2; // Velocidade de rotação em radianos por segundo
    const JUMP_POWER = 7;
    const GRAVITY = -20;
    let velocityY = 0;
    let isGrounded = true;
    let godzillaRotationY = 0; // Ângulo de rotação do godzilla
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

    // ==================== CÂMERA THIRD-PERSON COM CONTROLE DE MOUSE ====================
    const camera = new BABYLON.ArcRotateCamera(
        "camera", 
        -Math.PI / 2, // Ângulo horizontal inicial (alpha)
        Math.PI / 3,  // Ângulo vertical inicial (beta)
        20,           // Distância do alvo (radius)
        new BABYLON.Vector3(0, 1, 0), // Ponto inicial que a câmera olha
        scene
    );
    
    // Configurações da câmera
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 8;  // Distância mínima
    camera.upperRadiusLimit = 15; // Distância máxima
    camera.lowerBetaLimit = 0.1;  // Limite inferior vertical (evita ir abaixo do chão)
    camera.upperBetaLimit = Math.PI / 2.1; // Limite superior vertical
    camera.wheelPrecision = 30; // Sensibilidade do scroll do mouse - DESATIVADO
    
    
    // Ativa movimento da câmera sem precisar clicar
    canvas.addEventListener("click", () => {
        canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
        if (canvas.requestPointerLock) {
            canvas.requestPointerLock();
        }
    });
    
    // Controle manual do mouse quando pointer lock está ativo
    const CAMERA_SENSITIVITY = 0.0001;
    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === canvas) {
            camera.alpha += e.movementX * CAMERA_SENSITIVITY;
            camera.beta += e.movementY * CAMERA_SENSITIVITY;
            
            // Limita o beta para não girar além dos limites
            camera.beta = Math.max(camera.lowerBetaLimit, Math.min(camera.upperBetaLimit, camera.beta));
        }
    });

    // ==================== TIROS / PROJÉTEIS ====================
    const PROJECTILE_SPEED = 35;
    const FIRE_COOLDOWN = 0.01; // segundos entre disparos ao segurar
    const PROJECTILE_LIFETIME = 2; // segundos
    const PROJECTILE_SIZE = 0.06;
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

        // Rotação do godzilla (A e D)
        if (keys.a) godzillaRotationY -= ROTATION_SPEED * dt;
        if (keys.d) godzillaRotationY += ROTATION_SPEED * dt;

        // Verifica se está em movimento
        const isMoving = keys.w || keys.s;

        // Movimento para frente/trás baseado na direção do godzilla (W e S)
        if (keys.w) {
            godzilla.position.x += Math.sin(godzillaRotationY) * MOVE_SPEED * dt;
            godzilla.position.z += Math.cos(godzillaRotationY) * MOVE_SPEED * dt;
        }
        if (keys.s) {
            godzilla.position.x -= Math.sin(godzillaRotationY) * MOVE_SPEED * dt;
            godzilla.position.z -= Math.cos(godzillaRotationY) * MOVE_SPEED * dt;
        }

        // Controla animação baseado no movimento
        if (godzilla.animationGroups && godzilla.animationGroups.length > 0) {
            if (isMoving) {
                godzilla.animationGroups.forEach(ag => {
                    if (keys.w) {
                        // Movimento para frente - animação normal
                        if (!ag.isPlaying || ag.speedRatio < 0) {
                            ag.stop();
                            ag.speedRatio = 1.3; // Velocidade da animação
                            ag.play(true); // true = loop
                        }
                    } else if (keys.s) {
                        // Movimento para trás - animação reversa
                        if (!ag.isPlaying || ag.speedRatio > 0) {
                            ag.stop();
                            ag.speedRatio = -1.3; // Velocidade da animação reversa
                            ag.play(true); // true = loop
                        }
                    }
                });
            } else {
                // Para animação se não estiver em movimento
                godzilla.animationGroups.forEach(ag => {
                    if (ag.isPlaying) {
                        ag.stop();
                    }
                });
            }
        }

        // Gravidade e pulo
        if (!isGrounded) {
            velocityY += GRAVITY * dt;
            godzilla.position.y += velocityY * dt;
        }
        if (godzilla.position.y <= 0) {  // godzilla posiçãoY
            godzilla.position.y = 0;
            velocityY = 0;
            isGrounded = true;
        }

        // Disparo contínuo com cooldown
        fireCooldownTimer -= dt;
        if (isFiring && fireCooldownTimer <= 0) {
            fireCooldownTimer = FIRE_COOLDOWN;
            const yaw = godzillaRotationY;
            const dir = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
            const spawnPos = new BABYLON.Vector3(
                godzilla.position.x + dir.x * 1.5,
                4.45, // projetil altura inicial projetil.y 
                godzilla.position.z + dir.z * 1.5
            );
            const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: PROJECTILE_SIZE * 2 }, scene);
            bullet.position.copyFrom(spawnPos);
            const bmat = new BABYLON.StandardMaterial("bulletMat", scene);
            bmat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.2); // projetil - cor amarela brilhante 
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

        // Atualiza o godzilla para apontar na direção controlada pelas teclas
        if (godzilla && godzilla.rotation) {
            godzilla.rotation.y = godzillaRotationY;
        }

        // Câmera segue o godzilla suavemente
        const targetCameraPosition = godzilla.position.clone();
        targetCameraPosition.y += 2; // Ajusta altura do ponto focal
        camera.setTarget(BABYLON.Vector3.Lerp(camera.target, targetCameraPosition, 0.1));
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
            { frame: 12, value: new BABYLON.Vector3(0, 0, 0) } //
        ]);
        box.animations = [anim];
        scene.beginAnimation(box, 0, 12, false, 1.5, () => {
            box.dispose();
        });
    };

    const createBox = (x, z, color) => {
        const box = BABYLON.MeshBuilder.CreateBox("box", { size: 8 }, scene);
        box.position.set(x, 1, z);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.diffuseColor = color;
        box.material = mat;
        boxes.push(box);
        return box;
    };
    // caixas coloridas para referência
    createBox(10 ,10,   new BABYLON.Color3(1, 0, 0));   // vermelho
    createBox(10, 20,   new BABYLON.Color3(0, 1, 0));   // verde
    createBox(10, 30,  new BABYLON.Color3(0, 0, 1));   // azul
    createBox(10, 40,  new BABYLON.Color3(1, 1, 0));   // amarelo
    createBox(-10 ,10,   new BABYLON.Color3(1, 0, 0));   // vermelho
    createBox(-10, 20,   new BABYLON.Color3(0, 1, 0));   // verde
    createBox(-10, 30,  new BABYLON.Color3(0, 0, 1));   // azul
    createBox(-10, 40,  new BABYLON.Color3(1, 1, 0));   // amarelo

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());