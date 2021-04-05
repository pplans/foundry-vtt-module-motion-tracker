import {MotionTracker} from './motion_tracker.js';

export function registerSettings()
{
  gmOnly_Settings();
}

export const REGISTER_CODE = 'motion_tracker';

    
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

function gmOnly_Settings()
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

	game.settings.register(REGISTER_CODE,'centerTracker',
	{
		name : 'MOTIONTRACKER.centerTrackerTitle',
		hint : 'MOTIONTRACKER.centerTrackerHint',
		scope :'world',
		config : true,
		default : true,
		type : Boolean
	});

	game.settings.register(REGISTER_CODE,'xOffset',
	{
		name : 'MOTIONTRACKER.xOffsetTitle',
		hint : 'MOTIONTRACKER.xOffsetHint',
		scope :'world',
		config : true,
		type: Number,
		default: 0
	});

	game.settings.register(REGISTER_CODE,'yOffset',
	{
		name : 'MOTIONTRACKER.yOffsetTitle',
		hint : 'MOTIONTRACKER.yOffsetHint',
		scope :'world',
		config : true,
		type: Number,
		default: 0
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