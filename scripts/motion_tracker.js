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
	settings.registerSettings();
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
		Hooks.call('motionTrackerInit', this);
		this._buildCanvas();
		this._initListeners();
		this._buildMotionTrackerDevice();
		this._startQueueHandler();
		this._nextAnimationHandler();
		this._welcomeMessage();
	}
    
	/**
	 * Create and inject the motion tracker canvas resizing to the window total size.
	 *
	 * @private
	 */
	_buildCanvas()
	{
		this.canvas = $('<div id="motion-tracker-canvas" style="position: absolute; left: 0; top: 0;pointer-events: none;"></div>');
		if(MotionTracker.CONFIG.canvasZIndex == 'over')
		{
			this.canvas.css('z-index',1000);
			this.canvas.appendTo($('body'));
		} 
		else
		{
			$("#motion-tracker").after(this.canvas);
		}
		this.currentCanvasPosition = MotionTracker.CONFIG.canvasZIndex;
		this.currentUseHighDPI = MotionTracker.CONFIG.useHighDPI;
		this._resizeCanvas();
	}
    
	/**
	 * resize to the window total size.
	 *
	 * @private
	 */
	_resizeCanvas()
	{
		const sidebarWidth = $('#sidebar').width();
		this.canvas.width(window.innerWidth - sidebarWidth + 'px');
		this.canvas.height(window.innerHeight - 1 + 'px');
	}
    
	/**
	 * Build the device.
	 *
	 * @private
	 */
	_buildMotionTrackerDevice()
	{
		let config = MotionTracker.ALL_CONFIG();
		this.device = new MotionTrackerDevice(this.canvas[0], config);
		this.device.initialize();
	}
    
	/**
	 * Init listeners on windows resize and on click if auto hide has been disabled within the settings.
	 *
	 * @private
	 */
	_initListeners()
	{
		this._rtime;
		this._timeout = false;
		$(window).resize(() =>
		{
			this._rtime = new Date();
			if (this._timeout === false)
			{
				this._timeout = true;
				setTimeout(this._resizeEnd.bind(this), 1000);
			}
		});

		game.socket.on('module.motion_tracker', (request) =>
		{
			switch(request.type)
			{
				case 'show':
					this.show(game.user, false, null, false, request.tokenReferenceId);
				break;
				case 'hide':
					this.hide(game.user, false);
				break;
				case 'update':
				break;
			}
		});
	}

	_resizeEnd()
	{
		if (new Date() - this._rtime < 1000)
		{
			setTimeout(this._resizeEnd.bind(this), 1000);
		}
		else
		{
			this._timeout = false;
			//resize ended probably, lets remake the canvas
			this.canvas[0].remove();
			this.device.clearScene();
			this._buildCanvas();
			this._resizeCanvas();
			let config = MotionTracker.ALL_CONFIG();
			this.device = new MotionTrackerDevice(this.canvas[0], config);
			this.device.initialize();
			this.device.preloadSounds();
		}
	}
    
	/**
	 * Start polling and watching te queue for animation requests.
	 * Each request is resolved in sequence.
	 *
	 * @private
	 */
	_startQueueHandler()
	{
		this.queue = [];
		setInterval(() =>
		{
			if (this.queue.length > 0)
			{
				let animate = this.queue.shift();
				animate();
			}
		}, 100);
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
	 * Show the motion tracker animation based on data configuration made by the User.
	 *
	 * @param user the user who made the call (game.user by default).
	 * @param synchronize
	 * @param users list of users or userId who can see the roll, leave it empty if everyone can see.
	 * @param blind if the call is blind for the current user
	 * @returns {Promise<boolean>} when resolved true if the animation was displayed, false if not.
	 */
	show(user = game.user, synchronize = true, users = null, blind = false, tokenId = null)
	{
		if(tokenId === null && canvas.tokens.controlled.length>0)
			tokenId = canvas.tokens.controlled[0].data._id;
		
		return new Promise((resolve, reject) =>
		{
			if (synchronize)
			{
				users = users && users.length > 0 ? (users[0].id ? users.map(user => user.id) : users) : users;
				game.socket.emit('module.motion_tracker', { type:'show', user: user.id, users: users, tokenReferenceId: tokenId });
			}
			this.device.setUserAndToken(tokenId, user);
			this.device.show();
			resolve();
			/*if(game.settings.get(settings.REGISTER_CODE,'immediatelyDisplayChatMessages'))
			{
				resolve();
			}*/
		});
	}
	hide(user = game.user, synchronize = true, users = null, blind = false)
	{
		return new Promise((resolve, reject) =>
		{
			if (synchronize)
			{
				users = users && users.length > 0 ? (users[0].id ? users.map(user => user.id) : users) : users;
				game.socket.emit('module.motion_tracker', { type:'hide', user: user.id, users: users });
			}
			this.device.hide();
			resolve();
			/*if(game.settings.get(settings.REGISTER_CODE,'immediatelyDisplayChatMessages'))
			{
				resolve();
			}*/
		});
	}

	toggle()
	{
		if(this.device.running)
			this.hide();
		else
			this.show();
	}
    
	_nextAnimationHandler()
	{
		let timing = 0;
		this.nextAnimation = new Accumulator(timing, (items)=>
		{
			for(let item of items)
				item.resolve(false);
		});
	}
    
	/**
	 *
	 * @private
	 */
	_beforeShow()
	{
	    if (this.timeoutHandle) {
		clearTimeout(this.timeoutHandle);
	    }
	    this.canvas.stop(true);
	    this.canvas.show();
	}
    
	/**
	 *
	 * @private
	 */
	_afterShow()
	{
	}
    
	copyto(obj, res)
	{
		if (obj == null || typeof obj !== 'object')
			return obj;
		if (obj instanceof Array)
		{
			for (var i = obj.length - 1; i >= 0; --i)
				res[i] = MotionTracker.copy(obj[i]);
		}
		else
		{
			for (var i in obj)
			{
				if (obj.hasOwnProperty(i))
					res[i] = MotionTracker.copy(obj[i]);
			}
		}
		return res;
	}
    
	copy(obj)
	{
	    if (!obj) return obj;
	    return MotionTracker.copyto(obj, new obj.constructor());
	}
    }
    
    class Accumulator
    {
	constructor (delay, onEnd)
	{
		this._timeout = null;
		this._delay = delay;
		this._onEnd = onEnd;
		this._items = [];
	}
    
	addItem (item)
	{
		this._items.push(item);
		if(this._timeout)
			clearTimeout(this._timeout);
		let callback = function()
		{
			this._onEnd(this._items)
			this._timeout = null
			this._items = [];
		}.bind(this);
		if(this._delay)
			this._timeout = setTimeout(callback, this._delay);
		else
			callback();
	}
    }