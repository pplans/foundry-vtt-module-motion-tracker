import { RGBELoader } from '../libs/three-modules/RGBELoader.js';
//import {GLTFExporter} from '../libs/three-modules/GLTFExporter.js';
import { RendererStats } from '../libs/three-modules/threex.rendererstats.js';
import * as THREE from '../libs/three.module.js';
import * as settings from './settings.js'

export class MotionTrackerDevice
{
	constructor(element_container, config)
	{
		//private variables
		this.container = element_container;
		this.dimensions = config.dimensions;
		this.config = config;
		this.speed = 1;
		this.isVisible = false;
		this.last_time = 0;
		this.running = false;
		this.allowInteractivity = false;
		this.raycaster = new THREE.Raycaster();
		this.scene_translation2D = {x:0, y: 0};
		this.globalScale = 1;

		this.user = null;

		this.display = {
			currentWidth: null,
			currentHeight: null,
			containerWidth: null,
			containerHeight: null,
			aspect: null,
			scale: null
		};

		this.cameraHeight = {
			max: null,
			close: null,
			medium: null,
			far: null
		};

		this.signals = [];
		this.signalsMax = 20;
		this.signalsObj = [];

		this.clock = new THREE.Clock();
		this.soundBank = {};
		this.lastSoundType = '';
		this.lastSoundStep = 0;
		this.lastSound = 0;
		this.iteration;
		this.renderer;
		this.camera;
		this.motion_tracker_surface;
		this.pane;

		//public variables
		this.public_interface = {};
		this.framerate = (1 / 60);
		this.sounds = true;
		this.volume = 1;
		this.soundDelay = 1; // time between sound effects in worldstep
		this.animstate = '';

		this.colors =
		{
			ambient: 0xffffff,
			spotlight: 0xffffff,
			ground: 0x242644
		};
	}

	preloadSounds()
	{
		let foundsounds = [];// TODO: 'scanning', 'close','medium','far'];
		foundsounds.forEach(v => 
		{
			let path = `modules/motion_tracker/sounds/${v}.wav`;
			AudioHelper.play({
				src: path,
				autoplay: false
			}, false);
			this.soundBank[v] = path;
		});
	}

	initialize()
	{
		return new Promise(async resolve =>
		{
			game.audio.pending.push(this.preloadSounds.bind(this));

			this.sounds = this.config.sounds == '1';
			this.volume = this.config.soundsVolume;

			this.speed = this.config.speed;

			this.scene = new THREE.Scene();
			if (game.motion_tracker!=null && game.motion_tracker.renderer != null)
			{
				this.renderer = game.motion_tracker.renderer;
				this.scene.traverse(object =>
				{
					if (object.type === 'Mesh') object.material.needsUpdate = true;
				});
			}
			else
			{
				this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
				if (this.config.useHighDPI)
					this.renderer.setPixelRatio(window.devicePixelRatio);
				await this.loadContextScopedTextures();
				//this.dicefactory.initializeMaterials();
				if(game.motion_tracker==null)
					game.motion_tracker = {renderer: this.renderer }
				else
					game.motion_tracker.renderer = this.renderer;
			}
			this.container.appendChild(this.renderer.domElement);

			this.renderer.setClearColor(0x000000, 0);

			this.setDimensions(this.config.dimensions);

			if(this.signalsObj.length==0)
			{
				for(let i = 0;i<this.signalsMax;++i)
				{
					this.signalsObj[i] = {
						geom: new THREE.PlaneGeometry(16, 16, 1, 1),
						material: new THREE.MeshBasicMaterial( { transparent: true, alphaMap: this.renderer.scopedTextureCache.ping_alpha, map: this.renderer.scopedTextureCache.ping_color, color: 0xffffff } )
					}
					this.signalsObj[i].material.opacity = 0.;
					this.signalsObj[i].material.depthTest = true;
					this.signalsObj[i].material.needUpdate = true;
					this.signalsObj[i].mesh = new THREE.Mesh(this.signalsObj[i].geom, this.signalsObj[i].material);
					this.signalsObj[i].mesh.receiveShadow = false;
					this.signalsObj[i].mesh.position.set(0, 0, -2);
					this.signalsObj[i].mesh.visible = false;
					this.scene.add(this.signalsObj[i].mesh);
				}
			}

			if(this.running)
				this.renderer.render(this.scene, this.camera);
			resolve();
		});
	}

	loadContextScopedTextures()
	{
		return new Promise(resolve =>
		{
			this.renderer.scopedTextureCache = {};
			let textureLoader = new THREE.TextureLoader();
			this.renderer.scopedTextureCache.background = textureLoader.load('modules/motion_tracker/textures/motion_tracker_background.webp');
			this.renderer.scopedTextureCache.ping_color = textureLoader.load('modules/motion_tracker/textures/motion_tracker_ping_color.webp');
			this.renderer.scopedTextureCache.ping_alpha = textureLoader.load('modules/motion_tracker/textures/motion_tracker_ping_alpha.webp');
			resolve();
		});
	}

	computeDisplayParameters(dimensions)
	{
		this.display.currentWidth = this.container.clientWidth / 2;
		this.display.currentHeight = this.container.clientHeight / 2;
		if (dimensions)
		{
			this.display.containerWidth = dimensions.w;
			this.display.containerHeight = dimensions.h;
		} else {
			this.display.containerWidth = this.display.currentWidth;
			this.display.containerHeight = this.display.currentHeight;
		}

		this.display.aspect = Math.min(this.display.currentWidth / this.display.containerWidth, this.display.currentHeight / this.display.containerHeight);

		this.globalScale = Math.min(1., Math.max(0.15, dimensions.w/settings.MAX_SIZE));
		this.scene_translation2D.x = (-0.5*this.display.currentWidth + 0.5*this.display.containerWidth);
		this.scene_translation2D.y = (-0.5*this.display.currentHeight + 0.5*this.display.containerHeight);
		if(game.settings.get(settings.REGISTER_CODE,'centerTracker'))
		{
			this.scene_translation2D.x = 0;
			this.scene_translation2D.y = 0;
		}
		this.scene_translation2D.x += game.settings.get(settings.REGISTER_CODE,'xOffset');
		this.scene_translation2D.y += game.settings.get(settings.REGISTER_CODE,'yOffset');

		if (this.config.autoscale)
			this.display.scale = Math.sqrt(settings.MAX_SIZE * settings.MAX_SIZE + settings.MAX_SIZE * settings.MAX_SIZE) / 13;
		else
			this.display.scale = this.config.scale;
	}

	setDimensions(dimensions)
	{
		this.computeDisplayParameters(dimensions);

		this.renderer.setSize(this.display.currentWidth * 2, this.display.currentHeight * 2);

		this.cameraHeight.max = this.display.currentHeight / this.display.aspect / Math.tan(10 * Math.PI / 180);

		this.cameraHeight.medium = this.cameraHeight.max / 1.5;
		this.cameraHeight.far = this.cameraHeight.max;
		this.cameraHeight.close = this.cameraHeight.max / 2;

		if (this.camera)
			this.scene.remove(this.camera);
		this.camera = new THREE.OrthographicCamera(
			this.display.currentWidth / - 2, this.display.currentWidth / 2,
			this.display.currentHeight / 2, this.display.currentHeight / - 2,
			 1, this.cameraHeight.max * 1.3);
		//this.camera = new THREE.PerspectiveCamera(20, this.display.currentWidth / this.display.currentHeight, 1, this.cameraHeight.max * 1.3);
		this.camera.position.z = this.cameraHeight.far;
		this.camera.near = 10;
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));

		const material = new THREE.MeshBasicMaterial( { map: this.renderer.scopedTextureCache.background, color: 0xffffff } );
		this.motion_tracker_surface = new THREE.Mesh(new THREE.PlaneGeometry(settings.MAX_SIZE, settings.MAX_SIZE, 1, 1), material);
		this.motion_tracker_surface.scale.set(this.globalScale, this.globalScale, 1);
		this.motion_tracker_surface.receiveShadow = false;
		this.motion_tracker_surface.position.set(this.scene_translation2D.x, this.scene_translation2D.y, -1);
		this.scene.add(this.motion_tracker_surface);
		if(this.running)
			this.renderer.render(this.scene, this.camera);
	}

	update(config)
	{
		this.sounds = config.sounds;
		this.volume = config.soundsVolume;
		this.scene.traverse(object => {
			if (object.type === 'Mesh') object.material.needsUpdate = true;
		});
	}

	playSound(sound)
	{
		let volume = sound[1] * this.volume;
		AudioHelper.play({
			src: sound[0],
			volume: volume
		}, false);
	}

	takeSnapshot()
	{
		if(this.user===null)
			return;
		// wipe precedent signals
		this.signals.length = 0;

		const scene = game.scenes.get(this.user.viewedScene);
		const tokens = scene.data.tokens;
		const tokensSelected = canvas.tokens.controlled;
		const seePlayers = game.settings.get(settings.REGISTER_CODE,'seePlayers');
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		const distPerPx = this.globalScale*settings.MAX_SIZE*.5/distanceMax;
		if(tokensSelected.length>0)
		{
			const selectedTok = canvas.tokens.controlled[0];
			const selectedTokenTransform = selectedTok.transform;
			const pos = canvas.tokens.controlled[0].getCenter(selectedTokenTransform.position.x, selectedTokenTransform.position.y);
			tokens.forEach(token => 
				{
					if(token.actorId!==selectedTok.data.actorId && !token.hidden)
					{
						const oPos = {x:token.x, y:token.y};
						oPos.x = (oPos.x-pos.x)/scene.data.grid;
						oPos.y = (pos.y-oPos.y)/scene.data.grid;
						const normDir = Math.sqrt(oPos.x*oPos.x+oPos.y*oPos.y);
						let scanResult = { distance: scene.data.gridDistance*normDir };
						if(scanResult.distance>distanceMax)
							return;
						scanResult.dir = {x: oPos.x/normDir, y: oPos.y/normDir};
						this.signals.push(scanResult);
					}
				});
		}
		for(let i = 0;i<this.signalsObj.length;++i)
		{
			if(i<this.signals.length)
			{
				this.signalsObj[i].material.opacity = 1.;
				this.signalsObj[i].material.needUpdate = true;
				this.signalsObj[i].mesh.scale.set(this.globalScale, this.globalScale, 1);
				this.signalsObj[i].mesh.position.set(
					distPerPx*this.signals[i].dir.x*this.signals[i].distance + this.scene_translation2D.x
					, distPerPx*this.signals[i].dir.y*this.signals[i].distance + this.scene_translation2D.y
					, 0);
				this.signalsObj[i].mesh.visible = true;
			}
			else
				this.signalsObj[i].mesh.visible = false;
		}
	}

	render()
	{
		if(this.running)
		{
			const size = game.settings.get(settings.REGISTER_CODE, 'size');
			this.computeDisplayParameters({w:size,h:size});
			if(this.motion_tracker_surface)
			{
				this.motion_tracker_surface.position.set(this.scene_translation2D.x, this.scene_translation2D.y, -1);
				this.motion_tracker_surface.scale.set(this.globalScale, this.globalScale, 1);
			}
			requestAnimationFrame( this.render.bind(this) );
			this.takeSnapshot();
			this.renderer.render(this.scene, this.camera);
		}
		else
		{
			cancelAnimationFrame(this.render.bind(this));
			this.renderer.clear();
		}
	}

	clearAll()
	{
		this.renderer.render(this.scene, this.camera);
		this.isVisible = false;
	}

	clearScene()
	{
		while (this.scene.children.length > 0)
		{
			this.scene.remove(this.scene.children[0]);
		}
		this.motion_tracker_surface.material.dispose();
		this.motion_tracker_surface.geometry.dispose();
	}

	setUser(user = game.user)
	{
		this.user = user;
	}

	show()
	{
		this.running = true;
		this.render();
	}

	hide()
	{
		this.running = false;
		this.isVisible = false;
	}

	showcase()
	{
		this.clearAll();

		if (this.motion_tracker_surface)
			this.scene.remove(this.motion_tracker_surface);

		this.camera.position.z = selectordice.length > 10 ? this.cameraHeight.far / 1.3 : this.cameraHeight.medium;

		this.renderer.render(this.scene, this.camera);
		setTimeout(() => {
			this.scene.traverse(object => {
				if (object.type === 'Mesh') object.material.needsUpdate = true;
			});
		}, 2000);
	}
}