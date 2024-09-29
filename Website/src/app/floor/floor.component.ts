import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const ws = new WebSocket('ws://localhost:8000');

interface Person {
  name: string;
  surname: string;
  pid: string;
  age: number;
  heart_desease: boolean;
  married: boolean;
  work_type: string;
  residence_type: string;
  avg_glucose: number;
  bmi: number;
  smoker: boolean;
}

interface Metrics {
  state: string;
  temperature: number;
  heart_rate: number;
  oxygen_saturation: number;
  blood_pressure_systalic: number;
  blood_pressure_diastalic: number;
  blood_sugar: number;
  respiration_rate: number;
  needs_medics: boolean;
}

let persons: Person[] = [];
let panels: THREE.Mesh[] = [];
let initialized: boolean = false;
let latestMetrics: Metrics[] = [];

@Component({
  selector: 'app-floor',
  templateUrl: './floor.component.html',
  styleUrls: ['./floor.component.scss']
})
export class FloorComponent implements OnInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  isDragging = false;
  previousMousePosition = {
    x: 0,
    y: 0
  };

  ngOnInit(): void {
    this.setupWebSocket();
    this.initThreeJsScene();
  }
  
  setupWebSocket(): void {
    ws.onerror = (error) => {
      console.error('WebSocket error: ', error);
    };
    
    ws.onopen = function open() {
      console.log('connected');
    };
    
    ws.onmessage = function message(event) {
    
      const json_data = JSON.parse(event.data);
    
      if (json_data.type === 0) {
        persons = json_data['array'];
        return;
      }
    
      latestMetrics = json_data['array'];

      if (panels.length == 8) for (let i = 0; i < 8; ++i) {
        const newColor = new THREE.Color('#00ff00');

        switch (latestMetrics[i].state) {
          case 'critical':
            newColor.set('#ff0000'); // Red color
            break;
          case 'needs medics':
            newColor.set('#ffff00'); // Yellow color
            break;
        }
        (panels[i].material as THREE.MeshStandardMaterial).color.set(newColor);
      }
      
    };
  }

  async initThreeJsScene(): Promise<void> {
    const container = this.canvasContainer.nativeElement;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8c9aa1);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 10;
    this.camera.position.y = 10;
    this.camera.rotation.x = -Math.PI / 4;

    // Renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.renderer.setClearColor(0xffffff, 1);

    // Enable shadow mapping in the renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 50;
    this.scene.add(light);

    // Load .webp texture for the walls using TextureLoader
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('assets/wall-texture.webp'); // Adjust path to your .webp file
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(2, 2); // Adjust scaling as needed

    // Create a material using the loaded .webp texture
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });

    // Materials for other objects
    const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

    // Create tile texture using canvas
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 512;
    tileCanvas.height = 512;
    const tileContext = tileCanvas.getContext('2d')!;

    // Fill background with white
    tileContext.fillStyle = '#ffffff';
    tileContext.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

    // Draw grid lines to represent tiles
    tileContext.strokeStyle = '#cccccc'; // Light grey lines for the grout
    tileContext.lineWidth = 2;
    const tileSize = 100;
    for (let x = 0; x <= tileCanvas.width; x += tileSize) {
      tileContext.beginPath();
      tileContext.moveTo(x, 0);
      tileContext.lineTo(x, tileCanvas.height);
      tileContext.stroke();
    }
    for (let y = 0; y <= tileCanvas.height; y += tileSize) {
      tileContext.beginPath();
      tileContext.moveTo(0, y);
      tileContext.lineTo(tileCanvas.width, y);
      tileContext.stroke();
    }

    // Create texture from canvas
    const tileTexture = new THREE.CanvasTexture(tileCanvas);
    tileTexture.wrapS = THREE.RepeatWrapping;
    tileTexture.wrapT = THREE.RepeatWrapping;
    tileTexture.repeat.set(10, 10);

    // Use the tile texture in the floor material with MeshBasicMaterial
    const floorMaterial = new THREE.MeshBasicMaterial({ map: tileTexture });

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(25, 25);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);

    // Helper functions to create objects
    const createWall = (
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number
    ) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.position.set(x, y, z);
      this.scene.add(wall);
    };

    // Function to create a rounded rectangle shape for the pillow
    const createRoundedRectShape = (width: number, height: number, radius: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2 + radius, -height / 2);
      shape.lineTo(width / 2 - radius, -height / 2);
      shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
      shape.lineTo(width / 2, height / 2 - radius);
      shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
      shape.lineTo(-width / 2 + radius, height / 2);
      shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
      shape.lineTo(-width / 2, -height / 2 + radius);
      shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
      return shape;
    };

    const createBed = (x: number, y: number, z: number) => {
      // Create a mattress with the color #8ea2a9
      const mattressGeometry = new THREE.BoxGeometry(1.5, 0.3, 3);
      const mattressMaterial = new THREE.MeshStandardMaterial({ color: 0x8ea2a9 }); // Color for mattress
      const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
      mattress.position.set(x, y + 0.3, z);
      mattress.castShadow = true;
      mattress.receiveShadow = true;
      this.scene.add(mattress);
    
      // Create sheet fold (a thin, slightly larger layer over the bedding)
      const foldGeometry = new THREE.PlaneGeometry(1.55, 0.2); // Slightly larger than the mattress
      const foldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // White color for the sheet
        side: THREE.DoubleSide, // Visible from both sides
      });
      const fold = new THREE.Mesh(foldGeometry, foldMaterial);
      fold.rotation.x = -Math.PI / 2; // Lay flat like a blanket
      fold.position.set(x, y + 0.51, z - 0.4); // Position it just above the mattress
      fold.castShadow = true;
      fold.receiveShadow = true;
      this.scene.add(fold);

      // Create sheets (a thin, slightly larger layer over the bedding)
      const sheetGeometry = new THREE.PlaneGeometry(1.55, 2); // Slightly larger than the mattress
      const sheetMaterial = new THREE.MeshStandardMaterial({
        color: 0x8ea2a9, // White color for the sheet
        side: THREE.DoubleSide, // Visible from both sides
      });
      const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
      sheet.rotation.x = -Math.PI / 2; // Lay flat like a blanket
      sheet.position.set(x, y + 0.5, z + 0.5); // Position it just above the mattress
      sheet.castShadow = true;
      sheet.receiveShadow = true;
      this.scene.add(sheet);
    
      // Create a rounded rectangle shape for the pillow
      const pillowShape = createRoundedRectShape(1, 0.3, 0.2);
    
      // Extrude the shape to give the pillow thickness
      const extrudeSettings = { depth: 0.5, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.1 };
      const pillowGeometry = new THREE.ExtrudeGeometry(pillowShape, extrudeSettings);
    
      // Create the material for the pillow
      const pillowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White color for the pillow
    
      // Create the pillow mesh
      const pillow = new THREE.Mesh(pillowGeometry, pillowMaterial);
    
      // Position the single pillow
      pillow.position.set(x, y + 0.45, z - 1.2);
      pillow.castShadow = true;
      pillow.receiveShadow = true;

      // Create sheet fold (a thin, slightly larger layer over the bedding)
      const behindGeometry = new THREE.BoxGeometry(1.5, 0.15, 0.45); // Slightly larger than the mattress
      const behindMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // White color for the sheet
        side: THREE.DoubleSide, // Visible from both sides
      });
      const behind = new THREE.Mesh(behindGeometry, behindMaterial);
      behind.rotation.x = -Math.PI / 2; // Lay flat like a blanket
      behind.position.set(x, y + 0.35, z + 1.58); // Position it just above the mattress
      behind.castShadow = true;
      behind.receiveShadow = true;
      this.scene.add(behind);
    
      this.scene.add(pillow);
    };
    
    const createChair = (x: number, y: number, z: number) => {
      const chairGeometry = new THREE.BoxGeometry(0.7, 0.5, 0.7);
      const chair = new THREE.Mesh(chairGeometry, chairMaterial);
      chair.castShadow = true;
      chair.receiveShadow = true;
      chair.position.set(x, y, z);
      this.scene.add(chair);
    };

    // Function to create a panel with text
    const createPanelWithText = (person: Person, x: number, y: number, z: number) => {
      const fontLoader = new FontLoader();

      fontLoader.load('assets/fonts/helvetiker_regular.typeface.json', (font) => {
        // Create a panel (PlaneGeometry)
        const panelGeometry = new THREE.PlaneGeometry(1.5, 3);
        const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        (panel as any).person_id = person.pid;
        panels.push(panel);
        panel.rotation.x = -Math.PI / 2; // Lay the panel flat
        panel.position.set(x, y, z);
        this.scene.add(panel);

        // Create text geometry
        const nameGeometry = new TextGeometry(person.name, {
          font: font,
          size: 0.35, // Text size
          height: 0.05, // Text depth
          curveSegments: 12,
          bevelEnabled: false
        });

        // Create text geometry
        const surnameGeometry = new TextGeometry(person.surname, {
          font: font,
          size: 0.35, // Text size
          height: 0.05, // Text depth
          curveSegments: 12,
          bevelEnabled: false
        });

        // Create the text material
        const textMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black text color
        const nameMesh = new THREE.Mesh(nameGeometry, textMaterial);
        const surnameMesh = new THREE.Mesh(surnameGeometry, textMaterial);

        // Position the text slightly above the panel to prevent z-fighting
        nameMesh.rotation.x = -Math.PI / 2;
        nameMesh.rotation.z = +Math.PI / 2;
        nameMesh.position.set(x - 0.15, y + 0.1, z + 1.1); // Adjust position to place text on the panel

        surnameMesh.rotation.x = -Math.PI / 2;
        surnameMesh.rotation.z = +Math.PI / 2;
        surnameMesh.position.set(x + 0.45, y + 0.1, z + 1.1); // Adjust position to place text on the panel

        // Add the text to the scene
        this.scene.add(nameMesh);
        this.scene.add(surnameMesh);
      });
    }

    // Add ambient light for overall scene brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Adjust the existing directional light intensity if needed
    light.intensity = 1.5;

    // Create a room with two beds placed side by side (parallel)
    const createRoom = (xOffset: number, zOffset: number, person1: Person, person2: Person) => {
      const roomSize = 8; // Size of each room
      const wallThickness = 0.2;

      // Back and front walls
      createWall(xOffset, 1, zOffset - roomSize / 2, roomSize + wallThickness, 2, wallThickness); // Back wall
      createWall(xOffset, 1, zOffset + roomSize / 2, roomSize + wallThickness, 2, wallThickness); // Front wall

      // Left and right walls
      createWall(xOffset - roomSize / 2, 1, zOffset, wallThickness, 2, roomSize + wallThickness); // Left wall
      createWall(xOffset + roomSize / 2, 1, zOffset, wallThickness, 2, roomSize + wallThickness); // Right wall

      // Place two beds side by side (parallel)
      createBed(xOffset - 2.5, 0.1, zOffset - 1.4); // First bed on the left
      createChair(xOffset - 0.7, 0.5, zOffset - 2.4); // Chair in the room
      createPanelWithText(person1, xOffset - 2.5, 0.1, zOffset + 2);
      
      createBed(xOffset + 1, 0.1, zOffset - 1.4); // Second bed on the right
      createChair(xOffset + 2.7, 0.5, zOffset - 2.4); // Chair in the room
      createPanelWithText(person2, xOffset + 1, 0.1, zOffset + 2);
    };

    // Create a 2x2 grid of rooms with two beds each, centered at (0, 0)
    const roomSize = 8; // Each room is 8 units wide and tall
    const gridOffset = (roomSize / 2); // Offset to center the grid

    let index = 0; 

    await new Promise<void>((resolve) => {
      const checkPersonsLength = () => {
        if (persons.length === 8) {
          resolve();
        } else {
          setTimeout(checkPersonsLength, 100);
        }
      };

      checkPersonsLength();
    });

    for (let i = 0; i <= 1; i++) { // 2x2 grid
      for (let j = 0; j <= 1; j++) {
        const xOffset = (i * roomSize) - gridOffset;
        const zOffset = (j * roomSize) - gridOffset;
        createRoom(xOffset, zOffset, persons[2 * index], persons[2 * index + 1]);
        ++index;
      }
    }

    // Event listeners for dragging to rotate the scene
    container.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    container.addEventListener('mouseup', this.onMouseUp.bind(this), false);
    container.addEventListener('mousemove', this.onMouseMove.bind(this), false);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  // Mouse down event to start dragging
  onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  // Mouse up event to stop dragging
  onMouseUp(): void {
    this.isDragging = false;
  }

  // Mouse move event to rotate the scene while dragging
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) {
      return;
    }

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    const rotationSpeed = 0.005;

    this.scene.rotation.y += deltaX * rotationSpeed;
    this.scene.rotation.x += deltaY * rotationSpeed;

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
}
