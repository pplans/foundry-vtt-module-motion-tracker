import {MotionTracker} from './motion_tracker.js';

export function registerSettings(callbackResize)
{
  gmOnly_Settings(callbackResize);
}

export const REGISTER_CODE = 'motion_tracker';
export const MAX_SIZE = 512;
export const MAX_PING_SIZE = 64;

    
/**
 * Form application to configure settings of the Motion Tracker.
 */
class MotionTrackerConfig extends FormApplication
{
	static get defaultOptions()
	{
		return super.defaultOptions;
	}

	getData(options)
	{
		return {};
	}

	activateListeners(html)
	{
		super.activateListeners(html);
	}

	onApply(event)
	{
		event.preventDefault();
	}

	onReset()
	{
		this.reset = true;
		this.render();
	}

	close(options)
	{
		super.close(options);
		this.device.clearScene();
	}
}

function gmOnly_Settings(callbackResize)
{

	/*game.settings.registerMenu(REGISTER_CODE, REGISTER_CODE,
	{
		name: 'MOTIONTRACKER.config',
		label: 'MOTIONTRACKER.configTitle',
		hint: 'MOTIONTRACKER.configHint',
		icon: 'fas motion-tracker-ico',
		type: MotionTrackerConfig,
		restricted: false
	});*/
    
	/*game.settings.register(REGISTER_CODE, 'settings',
	{
		name: 'Motion Tracker Settings',
		scope: 'client',
		default: MotionTracker.DEFAULT_OPTIONS,
		type: Object,
		config: false,
		onChange: settings =>
		{
			if (game.motion_tracker)
			{
				// TODO
			}
		}
	});*/

	game.settings.register(REGISTER_CODE, 'enabled',
	{
		scope: 'world',
		type: Boolean,
		default: true,
		config: false
	});

	game.settings.register(REGISTER_CODE,'gmOnly',
	{
		name : 'MOTIONTRACKER.gmOnlyTitle',
		hint : 'MOTIONTRACKER.gmOnlyHint',
		scope :'world',
		config : true,
		default : true,
		type : Boolean
	});

	game.settings.register(REGISTER_CODE,'seePlayers',
	{
		name : 'MOTIONTRACKER.seePlayersTitle',
		hint : 'MOTIONTRACKER.seePlayersHint',
		scope :'world',
		config : true,
		default : true,
		type : Boolean
	});

	game.settings.register(REGISTER_CODE,'size',
	{
		name : 'MOTIONTRACKER.sizeTitle',
		hint : 'MOTIONTRACKER.sizeHint',
		scope :'world',
		config : true,
		type: Number,
		default: 200,
		range: {
		    min: 50,
		    max: MAX_SIZE,
		    step: 10
		},
		onChange: settings =>
		{
			callbackResize(settings)
		}
	});

	game.settings.register(REGISTER_CODE,'maxDistance',
	{
		name : 'MOTIONTRACKER.maxDistanceTitle',
		hint : 'MOTIONTRACKER.maxDistanceHint',
		scope :'world',
		config : true,
		type: Number,
		default: 80,
		range: {
		    min: 5,
		    max: 100,
		    step: 1
		}
	});
}