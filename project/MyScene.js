import { CGFscene, CGFcamera, CGFaxis, CGFtexture, CGFshader } from "../lib/CGF.js";
import { MyPlane } from "./primitives/MyPlane.js";
import { MyPanorama } from "./MyPanorama.js";
import { MyBuilding } from "./objects/building/MyBuilding.js";
import { MyCone } from "./primitives/MyCone.js";
import { MyPyramid } from "./primitives/MyPyramid.js"; 
import { MyTree } from "./objects/forest/MyTree.js";
import { MyForest } from "./objects/forest/MyForest.js";
import { MyHeli } from "./objects/helicopter/MyHeli.js";
import { MyFire } from "./objects/MyFire.js";
import { updateCameraFromHelicopter, updateCameraThirdPerson, findControllerByProperty } from "./CameraUtils.js";

/**
 * MyScene
 * @constructor
 */
export class MyScene extends CGFscene {
  constructor() {
    super();
    this.cameraView = '0: Default';
    this.firstPersonView = false;
    this.thirdPersonView = false;

    // Store initial camera settings for reset
    this.initialCameraPosition = vec3.fromValues(30, 30, 30);
    this.initialCameraTarget = vec3.fromValues(0, 15, 0);

    this.lastT = null;
    this.deltaT = null;

    this.acceleration = 6;
    this.deceleration = 4;
    this.turnSpeed = 1;

    this.speedFactor = 1;

    this.heliportPosition = [0, 0, 0];
    this.heliportRadius = 1;

    this.prevP = false;
    this.prevL = false;
    
    // Fire Areas
    // areas as rectangles [x1, z1, x2, z2]
    this.fireAreas = [
      [-60, -100, 150, -20],
      [176, -55, 62, 60],
      [140, 130, 8, 53]
    ];
    
    this.fires = [];
    this.maxFires = 3;
    this.showFireParticles = true;

    this.maskLoaded = false;
    this.maskData = null;
    this.maskWidth = 0;
    this.maskHeight = 0;
  }

  init(application) {
    super.init(application);

    this.initCameras();
    this.initLights();

    //Background color
    this.gl.clearColor(0, 0, 0, 1.0);

    this.gl.clearDepth(100.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.depthFunc(this.gl.LEQUAL);

    this.enableTextures(true);

    //Initialize scene objects
    this.axis = new CGFaxis(this, 50, 1);
    this.plane = new MyPlane(this, 64, 0, 1, 0, 1);
    
    // Tree textures
    this.treeTextures = {
      trunkTexture: new CGFtexture(this, "textures/tree/trunk.png"),
      shadowTexture: new CGFtexture(this, "textures/tree/shadow.png"),
      green: {
        baseTexture: new CGFtexture(this, "textures/tree/leaves/original/leaves-base.png"),
        sideTextureShadow: new CGFtexture(this, "textures/tree/leaves/original/leaves-shadow.png"),
        sideTextureTop: new CGFtexture(this, "textures/tree/leaves/original/leaves.png"),
      },
      yellow: {
        baseTexture: new CGFtexture(this, "textures/tree/leaves/yellow/leaves-base.png"),
        sideTextureShadow: new CGFtexture(this, "textures/tree/leaves/yellow/leaves-shadow.png"),
        sideTextureTop: new CGFtexture(this, "textures/tree/leaves/yellow/leaves.png"),
      },
      orange: {
        baseTexture: new CGFtexture(this, "textures/tree/leaves/orange/leaves-base.png"),
        sideTextureShadow: new CGFtexture(this, "textures/tree/leaves/orange/leaves-shadow.png"),
        sideTextureTop: new CGFtexture(this, "textures/tree/leaves/orange/leaves.png"),
      }
    };
    
    // fire textures
    this.fireTextures = [
      new CGFtexture(this, "textures/fire/fire1.png"),
      new CGFtexture(this, "textures/fire/fire2.png"),
      new CGFtexture(this, "textures/fire/fire3.png")
    ];
    
    this.buildingWidth = 15;
    this.buildingDepth = 12;
    this.numFloorsSide = 2;
    this.numWindowsPerFloor = 3;
    this.windowTexture = new CGFtexture(this, "textures/building/window.jpg");
    this.buildingColor = [0.5, 0.5, 0.5, 1];
    this.building = new MyBuilding(
      this, 
      this.buildingWidth, 
      this.buildingDepth, 
      this.numFloorsSide, 
      this.numWindowsPerFloor, 
      this.windowTexture, 
      this.buildingColor
    );
                    
    this.cone = new MyCone(this);
    this.pyramid = new MyPyramid(this);
    this.tree = new MyTree(this, 0, 'X', 0.1, 2, 0, this.treeTextures);
    //this.forestLarge = new MyForest(this, 20, 20, 40, 40);
    this.forest = new MyForest(this, 7, 7, 10, 10, this.treeTextures);
    this.forestSmall = new MyForest(this, 2, 2, 2, 2, this.treeTextures);
    this.helicopter = new MyHeli(this);
    
    // fire related 
    this.lastFireAnimTime = 0;
    this.fireAnimInterval = 120;
    

    this.displayAxis = false;
    this.displayNormals = false;
    this.displayForest = true;
    this.fpsRate = 24;

    this.setUpdatePeriod(1000/this.fpsRate);

    this.panoramaTexture = new CGFtexture(this, "textures/panorama.png");

    this.panorama = new MyPanorama(this, this.panoramaTexture);

    this.grassTexture = new CGFtexture(this, "textures/grass/grass3.jpg");
    this.waterTexture = new CGFtexture(this, "textures/lake/water.jpg");
    let lakeTexturePath = 'textures/lake/lake_mask2.png';
    this.lakeMaskTexture = new CGFtexture(this, lakeTexturePath);
    this.maskShader = new CGFshader(this.gl, "shaders/lake/lake.vert", "shaders/lake/lake.frag");
    this.maskShader.setUniformsValues({
      uMaskSampler: 0,
      uGrassSampler: 1,
      uWaterSampler: 2,
      textureScale: 100,
      time: 0,
    });
    this.maskImage = new Image();
    this.maskImage.src = lakeTexturePath;
    this.maskImage.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = this.maskImage.width;
        canvas.height = this.maskImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.maskImage, 0, 0);
        this.maskData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        this.maskWidth = canvas.width;
        this.maskHeight = canvas.height;
        this.maskLoaded = true;
    };

    this.waterShader = new CGFshader(this.gl, "shaders/water/water.vert", "shaders/water/water.frag");
    this.waterShader.setUniformsValues({ uTime: 0 });
  }
  initLights() {
    this.lights[0].setPosition(200, 200, 200, 1);
    this.lights[0].setDiffuse(1.2, 1.2, 1.2, 1.0);
    this.lights[0].setSpecular(1.5, 1.5, 1.5, 1.0);
    this.lights[0].setAmbient(0.5, 0.5, 0.5, 1.0);
    this.lights[0].enable();
    this.lights[0].update();

    this.lights[1].setPosition(150, 300, 50, 1); // Position directly above the scene
    this.lights[1].setDiffuse(1.0, 1.0, 0.8, 1.0); // Slightly warm light
    this.lights[1].setSpecular(1.0, 1.0, 0.8, 1.0);
    this.lights[1].setAmbient(0, 0, 0, 1.0);
    this.lights[1].enable();
    this.lights[1].update();

    // Light 2: Moonlight or secondary light
    this.lights[2].setPosition(-50, 100, 250, 1); // Position diagonally in the sky
    this.lights[2].setDiffuse(0.5, 0.6, 0.5, 1.0); // Cool blue light
    this.lights[2].setSpecular(0.5, 1.0, 0.5, 1.0);
    this.lights[2].setAmbient(0, 0, 0, 1.0);
    this.lights[2].enable();
    this.lights[2].update();
  }
  initCameras() {
    this.camera = new CGFcamera(
      1.1,
      0.1,
      500,
      this.initialCameraPosition,
      this.initialCameraTarget
    );
  }

  resetCamera() {
    this.cameraView = '0: Default';
    this.firstPersonView = false;
    this.thirdPersonView = false;

    vec3.copy(this.camera.position, this.initialCameraPosition);
    vec3.copy(this.camera.target, this.initialCameraTarget);

    if (this.gui && this.gui.gui) {
      const camViewController = findControllerByProperty(this.gui.gui, 'cameraView');
      if (camViewController) camViewController.setValue('0: Default');
    }
  }

  toggleBucketFill() {
    this.helicopter.setBucketEmpty(!this.helicopter.getBucketIsEmpty());
  }

  isOverLake(position) {
    if (!this.maskLoaded) {
      return false;
    }

    const x = position[0];
    const z = position[2];

    const s = (x / 1000) + 0.5;
    let t = (-z / 1000) + 0.5;
    t = 1 - t;

    const pixelX = Math.floor(s * this.maskWidth);
    const pixelY = Math.floor(t * this.maskHeight);

    if (pixelX < 0 || pixelX >= this.maskWidth || pixelY < 0 || pixelY >= this.maskHeight) {
      return false;
    }

    const index = (pixelY * this.maskWidth + pixelX) * 4;
    const lakePoint = this.maskData[index];

    const LAKE_THRESHOLD = 50;
    return lakePoint < LAKE_THRESHOLD;
  }

  isOverFire(position) {
    const radius = 5; // radius to check for fire
    const x = position[0];
    const z = position[2];
    for (const fireInfo of this.fires) {
        const fx = fireInfo.position[0];
        const fz = fireInfo.position[2];
        const distSq = (x - fx) * (x - fx) + (z - fz) * (z - fz);
        if (distSq <= radius * radius) {
            return true;
        }
    }
    return false;
  }

  extinguishFireAt(position) {
    const radius = 15; // radius to extinguish fire
    for (const fireInfo of this.fires) {
        const fx = fireInfo.position[0];
        const fz = fireInfo.position[2];
        const x = position[0];
        const z = position[2];
        const distSq = (x - fx) * (x - fx) + (z - fz) * (z - fz);
        if (distSq <= radius * radius) {
            fireInfo.fire.graduallyRemoveTriangles();
            // remove fire from array
            setTimeout(() => {
              const idx = this.fires.indexOf(fireInfo);
              if (idx !== -1) this.fires.splice(idx, 1);
            }, 1500);
            break;
        }
    }
  }

  update(t) {
    const heliWorldPos = this.helicopter.getWorldPosition();
    let turbulenceStrength = this.helicopter.getLakeTransitionProgress();

    this.maskShader.setUniformsValues({
      uHeliPos: [heliWorldPos[0], heliWorldPos[2]],
      uTurbulence: turbulenceStrength,
      time: t / 1000.0 % 1000,
      heightScale: 0.001,
      waterDisturbance: 0.1
    });

    // Fire(s) animation
    for (const fireInfo of this.fires) {
      fireInfo.fire.update(t);
    }

    if (this.lastT != null) {
        this.deltaT = t - this.lastT;
    } else {
      this.deltaT = 0;
    }
    this.lastT = t;
    const dt = this.deltaT / 1000;

    // Camera controls
    if (this.gui.isKeyPressed("Digit0")) {
      if (this.cameraView !== '0: Default') {
        this.cameraView = '0: Default';
        if (this.gui && this.gui.gui) {
          const camViewController = findControllerByProperty(this.gui.gui, 'cameraView');
          if (camViewController) camViewController.setValue('0: Default');
        }
      }
    } else if (this.gui.isKeyPressed("Digit1")) {
      if (this.cameraView !== '1: First Person') {
        this.cameraView = '1: First Person';
        if (this.gui && this.gui.gui) {
          const camViewController = findControllerByProperty(this.gui.gui, 'cameraView');
          if (camViewController) camViewController.setValue('1: First Person');
        }
      }
    } else if (this.gui.isKeyPressed("Digit2")) {
      if (this.cameraView !== '2: Third Person') {
        this.cameraView = '2: Third Person';
        if (this.gui && this.gui.gui) {
          const camViewController = findControllerByProperty(this.gui.gui, 'cameraView');
          if (camViewController) camViewController.setValue('2: Third Person');
        }
      }
    }

    const movementAllowed = this.helicopter.state === "flying" || this.helicopter.state == "pouring_water";

    switch (true) {
      case this.gui.isKeyPressed("KeyW") && movementAllowed:
          this.helicopter.accelerate(-this.acceleration * this.speedFactor * dt);
          break;

      case this.gui.isKeyPressed("KeyS") && movementAllowed:
          this.helicopter.accelerate(this.acceleration * this.speedFactor * dt * 0.8);
          break;

      case this.gui.isKeyPressed("KeyA") && movementAllowed:
          this.helicopter.turn(this.turnSpeed * this.speedFactor * dt);
          break;

      case this.gui.isKeyPressed("KeyD") && movementAllowed:
          this.helicopter.turn(-this.turnSpeed * this.speedFactor * dt);
          break;

      case this.gui.isKeyPressed("KeyR"):
          this.resetScene();
          break;

      default:
          const currentP = this.gui.isKeyPressed("KeyP");
          const currentL = this.gui.isKeyPressed("KeyL");

          if (currentP && !this.prevP) {
              this.helicopter.initiateTakeoff();
          }
          if (currentL && !this.prevL && this.helicopter.getBucketIsEmpty()) {
              this.helicopter.initiateLanding();
          }

          this.prevP = currentP;
          this.prevL = currentL;

          if (!this.gui.isKeyPressed("KeyW") && !this.gui.isKeyPressed("KeyS")) {
              const speedChange = -Math.sign(this.helicopter.speed) * this.deceleration * this.speedFactor * dt;
              this.helicopter.accelerate(speedChange);
              // Prevent small oscillations around zero
              if (Math.abs(this.helicopter.speed) < this.speedFactor * 0.1) {
                  this.helicopter.speed = 0;
                  this.helicopter.resetLeanAngle();
              }
          }
          break;
    }

    if (this.gui.isKeyPressed("KeyO") && this.isOverFire(heliWorldPos) && movementAllowed) {
      this.helicopter.startPouringWater();
    }

    if (this.waterShader) {
      this.waterShader.setUniformsValues({ 
        uTime: (t / 2000.0) % 1.0 
      });
    }

    if (this.gui.isKeyPressed("KeyF")) {
      this.setFire();
    }

    if (this.gui.isKeyPressed("KeyB")) {
      this.toggleBucketFill();
    }

    this.helicopter.update(dt);
    this.helicopter.updatePouringWater();

    if (this.cameraView === '1: First Person') {
      this.firstPersonView = true;
      this.thirdPersonView = false;
      updateCameraFromHelicopter(this.camera, this.helicopter);
    } else if (this.cameraView === '2: Third Person') {
        this.firstPersonView = false;
        this.thirdPersonView = true;
        updateCameraThirdPerson(this.camera, this.helicopter);
    } else {
        this.firstPersonView = false;
        this.thirdPersonView = false;
    }
  }

  setDefaultAppearance() {
    this.setAmbient(0.5, 0.5, 0.5, 1.0);
    this.setDiffuse(0.5, 0.5, 0.5, 1.0);
    this.setSpecular(0.5, 0.5, 0.5, 1.0);
    this.setShininess(10.0);
  }

  resetHelicopter() {
    this.helicopter.resetHelicopter();
    this.resetCamera();
  }

  // Create a new fire in a random position within one of the defined fire areas
  setFire() {
    if (this.fires.length >= this.maxFires) {
      console.log("Maximum number of fires reached");
      return false;
    }

    // min distance between fires
    const minDistanceBetweenFires = 10;
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const areaIndex = Math.floor(Math.random() * this.fireAreas.length);
      const area = this.fireAreas[areaIndex];
      const x = area[0] + Math.random() * (area[2] - area[0]);
      const z = area[1] + Math.random() * (area[3] - area[1]);
      
      // Check if position is too close to an existing fire
      let tooClose = false;
      for (const existingFire of this.fires) {
        const dx = existingFire.position[0] - x;
        const dz = existingFire.position[2] - z;
        const distanceSquared = dx * dx + dz * dz;
        
        if (distanceSquared < minDistanceBetweenFires * minDistanceBetweenFires) {
          tooClose = true;
          break;
        }      }
      
      if (!tooClose) {
        // Use preloaded textures when creating a new fire
        const fire = new MyFire(this, this.fireTextures);
        
        this.fires.push({
          fire: fire,
          position: [x, 0, z],
          scale: 4 + Math.random() * 2,         // 4 to 6
          rotation: Math.random() * Math.PI * 2
        });
        
        console.log(`Fire created at position [${x.toFixed(2)}, 0, ${z.toFixed(2)}]`);
        return true;
      }
      
      attempts++;
    }
    
    console.log("Could not find a suitable position for new fire after multiple attempts");
    return false;
  }

  resetFires() {
    this.fires = [];
  }

  resetScene() {
    this.resetHelicopter();
    this.resetFires();
  }

  display() {
    // Limit camera position
    if (this.camera.position[1] < 0.2) {
      this.camera.position[1] = 0.2;
    }
    
    // Limit camera distance from origin
    const maxDistance = 220;
    const distanceSquared = 
      this.camera.position[0] * this.camera.position[0] + 
      this.camera.position[1] * this.camera.position[1] + 
      this.camera.position[2] * this.camera.position[2];
    
    if (distanceSquared > maxDistance * maxDistance) {
      const currentDistance = Math.sqrt(distanceSquared);
      const scaleFactor = maxDistance / currentDistance;
      
      this.camera.position[0] *= scaleFactor;
      this.camera.position[1] *= scaleFactor;
      this.camera.position[2] *= scaleFactor;
    }

    // ---- BEGIN Background, camera and axis setup
    // Clear image and depth buffer everytime we update the scene
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    // Initialize Model-View matrix as identity (no transformation
    this.updateProjectionMatrix();
    this.loadIdentity();
    // Apply transformations corresponding to the camera position relative to the origin
    this.applyViewMatrix();

    this.gl.depthMask(false);
    this.panorama.display();
    this.gl.depthMask(true); 

    // Draw axis
    if (this.displayAxis) this.axis.display();

    this.setDefaultAppearance();

    // Apply plane material and display the plane
    this.pushMatrix();
    this.setActiveShader(this.maskShader);
    
    this.lakeMaskTexture.bind(0);
    this.grassTexture.bind(1);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    this.waterTexture.bind(2);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    
    //this.planeMaterial.apply();
    this.scale(1000, 1000, 1000);
    this.rotate(-Math.PI / 2, 1, 0, 0);
    this.plane.display();
    this.setActiveShader(this.defaultShader);
    this.popMatrix();


    // Display the building
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.pushMatrix();
    this.rotate(-Math.PI / 2, 1, 0, 0);
    this.translate(0, 10, 0);
    this.scale(5, 5, 5);
    this.building.display();
    this.popMatrix();
    this.gl.disable(this.gl.BLEND);
    

    //// FOREST
    if (this.displayForest) {
      this.pushMatrix();
      this.scale(6, 6, 6);
      this.translate(0, -0.05, 0);    /// !! this y-offset is important to make sure the trunk is "inside" the plane
      

      this.translate(-12, 0, -13.5); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();

      this.translate(-55, 0, -5.5);
      this.forest.display();
      this.translate(0, 0, -11);
      this.forest.display();
      this.translate(11, 0, 5);
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();
      this.translate(11, 0, 0); 
      this.forest.display();

      this.translate(-5, 0, -11);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(-6, 0, 11);
      this.forest.display();

      // side
      this.translate(43, 0, 23);
      this.forest.display();
      this.translate(11, 0, 0);
      this.forest.display();
      this.translate(11, 0, 0);
      this.forest.display();

      // front
      this.translate(-8, 0, 11);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(-11, 0, 0);
      this.forest.display();
      this.translate(0, 0, 11);
      this.forest.display();
      this.translate(11, 0, 0);
      this.forest.display();
      this.popMatrix();

      // details 
      this.pushMatrix();
      this.scale(6,6,6);
      this.translate(0,-0.05,0);

      this.translate(-9, 0, -1);
      this.forestSmall.display();
      this.translate(-7, 0, -7);
      this.forestSmall.display();
      this.translate(-11, 0, -6);
      this.forestSmall.display();
      this.translate(-5, 0, 0);
      this.forestSmall.display();

      this.translate(0, 0, -15);
      this.forestSmall.display();
      this.translate(0, 0, -6);
      this.forestSmall.display();
      this.translate(60, 0, 5.5);
      this.forestSmall.display();
      this.translate(5, 0, 6.5);
      this.forestSmall.display();
      this.translate(0, 0, 5);
      this.forestSmall.display();
      this.translate(5, 0, 0);
      this.forestSmall.display();

      this.translate(-2.5, 0, 28);
      this.forestSmall.display();

      this.translate(-6, 0, 11);
      this.forestSmall.display();
      this.translate(-5, 0, 0);
      this.forestSmall.display();
      this.translate(0, 0, 3);
      this.forestSmall.display();

      this.popMatrix();

      
      this.pushMatrix();
      this.scale(6, 6, 6);
      this.translate(0, -0.05, 0);

      //this.rotate(-Math.PI/2, 0, 1);
      //this.translate(0, 10, 0);
      

      this.translate(6.5, 0, -2);
      this.forestSmall.display();

      this.translate(0, 0, 8);
      this.forestSmall.display();

      this.translate(-9, 0, 4);
      this.forestSmall.display();

      this.translate(1, 0, 3);
      this.forestSmall.display();

      this.popMatrix();

      /*
      this.translate(-11, 0, 0);
      this.forest.display();

      this.translate(-11, 0, 0);
      this.forest.display();

      this.translate(5.5, 0, 12);
      this.forest.display();

      this.translate(22.5, 0, 0);
      this.forest.display();*/
      
/*
      // Trees, smaller area for details
      this.pushMatrix();
      this.scale(6,6,6);
      this.translate(0,-0.05,0);
      this.translate(-5.5,0,3);
      this.forestSmall.display();

      this.translate(0,0,5);
      this.forestSmall.display();

      this.translate(7,0,0);
      this.forestSmall.display();

      this.translate(0,0,-5);
      this.forestSmall.display();
      this.popMatrix();*/
    }

    this.setDefaultAppearance();
    // Helicopter
    const baseHeight = 15.1;
    this.pushMatrix();
    this.translate(0, baseHeight, 0);
    this.scale(0.22, 0.22, 0.22);
    this.rotate(Math.PI / 2, 0, 1, 0);
    this.helicopter.display();
    this.popMatrix();
    
    if (this.firstPersonView) {
      this.helicopter.displayCockpit();
    }
    
    // Fire
    /*
    this.pushMatrix();
    this.scale(5,5,5);
    this.translate(2, 0, 4);
    //his.fire.display();
    this.fire.display();
    this.popMatrix();
    */
    // Display all dynamically created fires
    for (const fireInfo of this.fires) {
      this.pushMatrix();
      this.translate(fireInfo.position[0], fireInfo.position[1], fireInfo.position[2]);
      this.rotate(fireInfo.rotation, 0, 1, 0);
      this.scale(fireInfo.scale, fireInfo.scale, fireInfo.scale);
      fireInfo.fire.display();
      this.popMatrix();
    }

    this.setDefaultAppearance();
  }
}
