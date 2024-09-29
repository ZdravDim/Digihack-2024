import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';

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
    this.initThreeJsScene();
  }

  initThreeJsScene(): void {
    const container = this.canvasContainer.nativeElement;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8c9aa1);

    // Camera (Keep original camera positioning)
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

    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x99aaff });
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

    const createBed = (x: number, y: number, z: number) => {
      const bedBaseGeometry = new THREE.BoxGeometry(1.5, 0.2, 3);
      const bedBase = new THREE.Mesh(bedBaseGeometry, bedMaterial);
      bedBase.position.set(x, y, z);
      bedBase.castShadow = true;
      bedBase.receiveShadow = true;
      this.scene.add(bedBase);

      const bedPillowGeometry = new THREE.BoxGeometry(1.5, 0.4, 1);
      const bedPillow = new THREE.Mesh(bedPillowGeometry, bedMaterial);
      bedPillow.castShadow = true;
      bedPillow.receiveShadow = true;
      bedPillow.position.set(x, y + 0.3, z - 1);
      this.scene.add(bedPillow);
    };

    const createChair = (x: number, y: number, z: number) => {
      const chairGeometry = new THREE.BoxGeometry(0.7, 1, 0.7);
      const chair = new THREE.Mesh(chairGeometry, chairMaterial);
      chair.castShadow = true;
      chair.receiveShadow = true;
      chair.position.set(x, y, z);
      this.scene.add(chair);
    };

    // Add ambient light for overall scene brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Adjust the existing directional light intensity if needed
    light.intensity = 1.5;

    // Create a room with two beds placed side by side (parallel)
    const createRoom = (xOffset: number, zOffset: number) => {
      const roomSize = 8; // Size of each room
      const wallThickness = 0.2;

      // Back and front walls
      createWall(xOffset, 1, zOffset - roomSize / 2, roomSize, 2, wallThickness); // Back wall
      createWall(xOffset, 1, zOffset + roomSize / 2, roomSize, 2, wallThickness); // Front wall

      // Left and right walls
      createWall(xOffset - roomSize / 2, 1, zOffset, wallThickness, 2, roomSize); // Left wall
      createWall(xOffset + roomSize / 2, 1, zOffset, wallThickness, 2, roomSize); // Right wall

      // Place two beds side by side (parallel)
      createBed(xOffset - 2.5, 0.1, zOffset - 1); // First bed on the left
      createBed(xOffset + 2.5, 0.1, zOffset - 1); // Second bed on the right

      // Place a chair between the two beds
      createChair(xOffset, 0.5, zOffset + 2); // Chair in the room
    };

    // Create a 2x2 grid of rooms with two beds each, centered at (0, 0)
    const roomSize = 8; // Each room is 8 units wide and tall
    const gridOffset = (roomSize / 2); // Offset to center the grid

    for (let i = 0; i <= 1; i++) { // 2x2 grid
      for (let j = 0; j <= 1; j++) {
        const xOffset = (i * roomSize) - gridOffset;
        const zOffset = (j * roomSize) - gridOffset;
        createRoom(xOffset, zOffset);
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
