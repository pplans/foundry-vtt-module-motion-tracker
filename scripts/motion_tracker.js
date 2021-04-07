import * as settings from './settings.js';
import * as dialog from './dialog.js';
import {MotionTrackerDevice} from './motion_tracker_device.js'

console.log("Motion Tracker Module Loaded");

export function renderMotionTrackerIcon()
{
	const lang_html = $(`
	<a class="chat-control-icon motion_tracker-dialog" title="Run Motion Tracker" style="margin-right: 7px">
		<i class="fas motion-tracker-ico"></i>
	</a>
	`);
	jQuery("#chat-controls label").before(lang_html);
	jQuery('a.motion_tracker-dialog').click(() => { game.motion_tracker.toggle({}); });
}

Hooks.on('init', ()=>
{
	settings.registerSettings((settings)=>
	{
		if(game.motion_tracker)
		{
			game.motion_tracker.resize(settings);
		}
	});
});

Hooks.on('setup', ()=>
{
	window.MotionTrackerDialog =
	{
		newDialog : dialog.newDialog
	};
})

Hooks.on('ready', ()=>
{
	if(game.user.isGM || !game.settings.get(settings.REGISTER_CODE, 'gmOnly'))
		setTimeout(renderMotionTrackerIcon(), 1000);

	game.motion_tracker = new MotionTracker();
	Hooks.on('renderDialog', (dialog, html, data) => {
		game.motion_tracker.setupDevice(dialog, html, data);
	});
});



/**
 * Main class to handle Motion Tracker Device.
 */
 export class MotionTracker
 {
	static get DEFAULT_OPTIONS()
	{
		return {
			enabled: true,
			timeBeforeHide: 2000,
			hideFX: 'fadeOut',
			autoscale: true,
			scale: 75,
			speed: 1,
			sounds: true,
			soundsVolume: 0.5,
			canvasZIndex:'over',
			useHighDPI:true
		};
	}
    
	static DEFAULT_APPEARANCE(user = game.user)
	{
		return { dimensions: { w: game.settings.get(settings.REGISTER_CODE, 'size'), h: game.settings.get(settings.REGISTER_CODE, 'size') } };
	}
    
	static ALL_DEFAULT_OPTIONS(user = game.user)
	{
		return mergeObject(MotionTracker.DEFAULT_OPTIONS, MotionTracker.DEFAULT_APPEARANCE(user));
	}
    
	static get CONFIG()
	{
		return MotionTracker.DEFAULT_OPTIONS;
	}
    
	static APPEARANCE(user = game.user)
	{
		let userAppearance = user.getFlag(settings.REGISTER_CODE, 'appearance');
		return mergeObject(MotionTracker.DEFAULT_APPEARANCE(user), userAppearance);
	}
    
	static ALL_CUSTOMIZATION(user = game.user)
	{
		return MotionTracker.APPEARANCE(user);
	}
    
	static ALL_CONFIG(user = game.user)
	{
		return mergeObject(MotionTracker.CONFIG, MotionTracker.APPEARANCE(user));
	}
    
	/**
	 * Ctor. Create and initialize a new motion tracker.
	 */
	constructor()
	{
		this.tokenId = null;
		this.user = null;
		this.windowElement = null;
		this.device = null;
		this.ownerId = "";
		this.viewedSceneId = "";
		this._buildWindow();
		this._initListeners();
		this._welcomeMessage();
	}
    
	/**
	 * Create the window that will host the canvas.
	 *
	 * @private
	 */
	_buildWindow()
	{
		const htmlContent = `<div id="motion-tracker-canvas" style="position: absolute; left: 0; top: 0;pointer-events: none;"></div>`;
		this.window = new Dialog({
			title: game.i18n.localize('MOTIONTRACKER.MotionTrackerDialogTitle'),
			content: htmlContent,
			buttons:
			{

			},
			close: () => { this.close(true, false); }
		});
		this.canvas = null;
		this.currentCanvasPosition = MotionTracker.CONFIG.canvasZIndex;
		this.currentUseHighDPI = MotionTracker.CONFIG.useHighDPI;
	}
    
	/**
	 * Init listeners on windows resize and on click if auto hide has been disabled within the settings.
	 *
	 * @private
	 */
	_initListeners()
	{
		game.socket.on('module.motion_tracker', (request) =>
		{
			switch(request.type)
			{
				case 'open':
					this.open(request.user, request.ownerId, request.tokenReferenceId, request.viewedSceneId);
				break;
				case 'close':
					this.close(false);
				break;
				case 'update':
				break;
			}
		});
	}
    
	/**
	 * Show a private message to new players
	 */
	_welcomeMessage()
	{
		if(!game.user.getFlag(settings.REGISTER_CODE,'welcomeMessageShown'))
		{
			if(!game.user.getFlag(settings.REGISTER_CODE,'appearance'))
			{
				renderTemplate("modules/motion_tracker/templates/welcomeMessage.html", {}).then((html)=>
				{
					let options = {
						whisper:[game.user.id],
						content: html
					};
					ChatMessage.create(options);
				});
			}
			game.user.setFlag(settings.REGISTER_CODE,'welcomeMessageShown',true);
		}
	}
    
	/**
	 * Check if 3D simulation is enabled from the settings.
	 */
	isEnabled()
	{
		return MotionTracker.CONFIG.enabled && game.settings.get(settings.REGISTER_CODE, 'enabled');
	}
    
	/**
	 * Update the device with fresh new settgins.
	 *
	 * @param settings
	 */
	update(settings)
	{
		this.device.update(settings);
	}

	/**
	 * Retrieve the canvas and build the motion tracking device then it renders
	 *
	 * @returns {Promise<boolean>} when resolved true if the animation was displayed, false if not.
	 */
	async setupDevice(dialog, html, data)
	{
		return new Promise((resolve, reject) =>
		{
			this.windowElement = dialog.element;
			this.canvas = html.find('#motion-tracker-canvas');
			if(this.canvas===null)
				return new Promise((resolve, reject) => resolve());
			const SIZE = game.settings.get(settings.REGISTER_CODE, 'size');
			let config = MotionTracker.ALL_CONFIG();
			this.device = new MotionTrackerDevice(this.canvas[0], config);
			this.device.initialize();
			this.device.setData(this.user, this.tokenId, this.viewedSceneId);
			this.device.show();
			this.resize(SIZE);
			resolve();
		});
	}
    
	/**
	 * Show the motion tracker animation based on data configuration made by the User.
	 *
	 * @param user the user who made the call (game.user by default).
	 * @param synchronize
	 * @param users list of users or userId who can see the roll, leave it empty if everyone can see.
	 * @param blind if the call is blind for the current user
	 * @returns {Promise<boolean>} when resolved true if the animation was displayed, false if not.
	 */
	async open(user = game.user, ownerId = game.user.id, tokenId = null, viewedScene = game.user.viewedScene)
	{
		if(this.tokenId === null && canvas.tokens.controlled.length>0)
			this.tokenId = canvas.tokens.controlled[0].data._id;
		this.user = user;
		this.ownerId = ownerId;
		this.viewedSceneId = viewedScene;
		return new Promise((resolve, reject) =>
		{
			if (this.ownerId==game.user.id)
			{
				game.socket.emit('module.motion_tracker', { type:'open', ownerId: this.ownerId, user: this.user, tokenReferenceId: this.tokenId, viewedSceneId: this.viewedSceneId });
			}
			this.window.render(true);
			resolve();
		});
	}
	close(forward, closeWindow = true)
	{
		this._timeout = false;
		//resize ended probably, lets remake the canvas
		this.canvas = null;
		return new Promise((resolve, reject) =>
		{
			if (forward && this.ownerId===game.user.id)
			{
				game.socket.emit('module.motion_tracker', { type:'close' });
			}
			if(this.device)
			{
				this.device.clearScene();
				this.device.hide();
			}
			if(closeWindow)
				this.window.close();
			this.tokenId = null;
			this.user = null;
			this.ownerId = null;
			this.windowElement = null;
			resolve();
		});
	}

	resize(size)
	{
		if(this.windowElement && this.canvas)
		{
			this.canvas[0].style.width =size+'px';
			this.canvas[0].style.height=size+'px';
			this.windowElement[0].style.width=size+'px';
			this.windowElement[0].style.height=size+'px';
			if(this.device!==null && this.device!==undefined)
				this.device.resize(size);
		}
	}

	toggle()
	{
		if(this.device && this.device.running)
			this.close(true);
		else
			this.open();
	}
    }
