/*
# Gnome shell extension Mediasplayers is a simple extension for displaying player control, music and music cover in Gnome Shell.
#
# Players supported (depend of the correct MPRIS support by the players) :
#
#    Banshee (full fonctionnal)
#    Rhythmbox
#    Clementine
#    Quodlibet
#    Audacious
#    Guayadeque
#    MPD serveur (for Gnome Musique Player for example)
#
# Follow the @ycdref account on Twitter to know the Updates
#
# Copyright (C) 2011,
# ycDref (Caccc) <d_dref@yahoo.fr>
#
# Part of code from Jean-Philippe Braun <eon@patapon.info> , j.wielicki <j.wielicki@sotecware.net>
#
# Gnome shell extension Mediasplayers is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
#
# Gnome shell extension Mediasplayers is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with Gnome shell extension Mediasplayers. If not, see http://www.gnu.org/licenses/.
*/

const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Gvc = imports.gi.Gvc;
const Signals = imports.signals;
const St = imports.gi.St;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
}

const VOLUME_ADJUSTMENT_STEP = 0.05; 
const VOLUME_NOTIFY_ID = 1;

var PLAYER_DEFAULT = "";
var DEFAULT_APP ="";
var PLAYPAUSE=0;
var COVER_PATH="";
var SETTING_APP="";

function Prop() {
    this._init();
}

Prop.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, PLAYER_DEFAULT, '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)

const MediaServer2PlayerIFace = {
    name: 'org.mpris.MediaPlayer2.Player',
    methods: [{ name: 'PlayPause',
                inSignature: '',
                outSignature: '' },
              { name: 'Pause',
                inSignature: '',
                outSignature: '' },
              { name: 'Play',
                inSignature: '',
                outSignature: '' },
              { name: 'Next',
                inSignature: '',
                outSignature: '' },
              { name: 'Previous',
                inSignature: '',
                outSignature: '' }],
    properties: [{ name: 'Metadata',
                   signature: 'a{sv}',
                   access: 'read'},
                 { name: 'Shuffle',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'CanGoNext',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanGoPrevious',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPlay',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPause',
                   signature: 'b',
                   access: 'read'}],
    signals: [{ name: 'Seeked',
                inSignature: 'x' }]
};

function MediaServer2Player() {
    this._init();
}

MediaServer2Player.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, PLAYER_DEFAULT, '/org/mpris/MediaPlayer2', this);
    },

 
    getMetadata: function(callback) {
        this.GetRemote('Metadata', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
     
    getPlaybackStatus: function(callback) {
        this.GetRemote('PlaybackStatus', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
            }));
    },
    
    getShuffle: function(callback) {
        this.GetRemote('Shuffle', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
    
    setShuffle: function(value) {
        this.SetRemote('Shuffle', value);
    },
    
    getVolume: function(callback) {
        this.GetRemote('Volume', Lang.bind(this,
            function(volume, ex) {
                if (!ex)
                    callback(this, volume);
            }));
    },

    setVolume: function(value) {
        this.SetRemote('Volume', value);
    },
    
    getRepeat: function(callback) {
        this.GetRemote('LoopStatus', Lang.bind(this,
            function(repeat, ex) {
                if (!ex) {
                    if (repeat == "None")
                        repeat = false
                    else
                        repeat = true
                    callback(this, repeat);
                }
            }));
    },

    setRepeat: function(value) {
        if (value)
            value = "Playlist"
        else
            value = "None"
        this.SetRemote('LoopStatus', value);
    }
}

DBus.proxifyPrototype(MediaServer2Player.prototype, MediaServer2PlayerIFace)

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function() {
        
	this._schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.mediasplayers' });
	SETTING_APP = this._schema.get_string("player");

    this._pIcon = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_size: Main.panel.button.get_child().height,
        icon_name: 'audio-x-generic'
    });

    PanelMenu.Button.prototype._init.call(this,0);

    let tBox = new St.BoxLayout();        
    tBox.add_actor(this._pIcon);
    this.actor.set_child(tBox);
    Main.panel._centerBox.add(this.actor, { y_fill: true });
    Main.panel._menus.addMenu(this.menu);

        
    this._songCover = new St.Bin({});
    this._songInformations = new St.Bin({});
    this._controlsButtons = new St.Bin({});
 
    let mainBox = new St.BoxLayout({vertical: true, style_class: 'back'});
    mainBox.add_actor(this._songCover);
    mainBox.add_actor(this._songInformations);
    mainBox.add_actor(this._controlsButtons);
    
    this.menu.addActor(mainBox);

    let infos = new St.BoxLayout({vertical: true});
    this._songInformations.set_child(infos);

    this._artist = new St.Label();
    this._album = new St.Label();
    infos.add_actor(this._artist);
    infos.add_actor(this._album);

    let controlsBox = new St.BoxLayout();
	this._controlsButtons.set_child(controlsBox);
    this._openApp = new St.Button({ style_class: 'button' });
    this._openApp.connect('clicked', Lang.bind(this,   
	  function () {
	    this._loadApp(DEFAULT_APP);
	  }	  
	));
    controlsBox.add_actor(this._openApp);
        
    this._mediaPrev = new St.Button({ style_class: 'button' });
    this._mediaPrev.connect('clicked', Lang.bind(this,  
		function () {
    		this._mediaServer.PreviousRemote();
        }
    ));        
    controlsBox.add_actor(this._mediaPrev);
	
	this._mediaPlay = new St.Button({ style_class: 'button' });
    this._mediaPlay.connect('clicked', Lang.bind(this, 
	    function () {
            this._mediaServer.PlayPauseRemote();
        }
    ));
    controlsBox.add_actor(this._mediaPlay); 
    
    this._mediaNext = new St.Button({ style_class: 'button' });
    this._mediaNext.connect('clicked', Lang.bind(this, 
	    function () {
            this._mediaServer.NextRemote();
        }
    ));
    controlsBox.add_actor(this._mediaNext); 

    this._openAppI = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
    icon_size: 48,
        icon_name: 'media-eject'
    });
    this._openApp.set_child(this._openAppI);      
	
    this._mediaPrevI = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 48,
        icon_name: 'media-skip-backward'
    });
    this._mediaPrev.set_child(this._mediaPrevI); 
    
    this._mediaPlayI = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 48,
        icon_name: 'media-playback-start'
    });
    this._mediaPlay.set_child(this._mediaPlayI); 
    
    this._mediaNextI = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 48,
        icon_name: 'media-skip-forward'
    });
    this._mediaNext.set_child(this._mediaNextI); 
    
    this._mediaPauseI = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 48,
        icon_name: 'media-playback-pause'
    });
    
    this._volume_text = new PopupMenu.PopupImageMenuItem(_("Volume"), "audio-volume-high", { reactive: false });
    this._volume = new PopupMenu.PopupSliderMenuItem(0);
    this._volume.connect('value-changed', Lang.bind(this, function(item) {
        this._mediaServer.setVolume(item._value);
    }));

    this.menu.addMenuItem(this._volume_text);
    this.menu.addMenuItem(this._volume);
    
    this._shuffle = new PopupMenu.PopupSwitchMenuItem(_("Shuffle"), false);
    this._shuffle.connect('toggled', Lang.bind(this, function(item) {
        this._mediaServer.setShuffle(item.state);
        this._updateSwitches();
    }));
    this.menu.addMenuItem(this._shuffle);
    
    this._repeat = new PopupMenu.PopupSwitchMenuItem(_("Repeat"), false);
    this._repeat.connect('toggled', Lang.bind(this, function(item) {
        this._mediaServer.setRepeat(item.state);
        this._updateSwitches();
    }));
    this.menu.addMenuItem(this._repeat);

	    
	switch (SETTING_APP){
      case "1":
		DEFAULT_APP = 'banshee';
		PLAYER_DEFAULT = "org.mpris.MediaPlayer2.banshee";
	   break;
      case "2": 
		DEFAULT_APP = 'rhythmbox';
		PLAYER_DEFAULT = "org.mpris.MediaPlayer2.rhythmbox";
	   break;
      case "3": 
		DEFAULT_APP = 'clementine';
		PLAYER_DEFAULT = "org.mpris.MediaPlayer2.clementine";
	   break;
      case "4": 
		DEFAULT_APP = 'quodlibet';
		PLAYER_DEFAULT ="org.mpris.MediaPlayer2.quodlibet";
	   break;
      case "5": 
		DEFAULT_APP = 'audacious';
		PLAYER_DEFAULT ="org.mpris.MediaPlayer2.audacious";
	   break;
      case "6": 
		DEFAULT_APP = 'guayadeque';
		PLAYER_DEFAULT ="org.mpris.MediaPlayer2.guayadeque";
	   break;
      case "7": 
		DEFAULT_APP = 'gmpc';
		PLAYER_DEFAULT ="org.mpris.MediaPlayer2.mpd";
	   break;
	}
	
	this._mediaServer = new MediaServer2Player();
    this._prop = new Prop();
	
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupMenuItem(_("MediasPlayers Settings ..."));
    item.connect('activate', Lang.bind(this, function(item) {
    	this._loadApp('mediasplayers-settings');
	}));
    this.menu.addMenuItem(item);
    
    
    this._updateMetadata();
    this._updateSwitches();
    this._updatePlayPause();
    this._updateVolume();
    
    this._prop.connect('PropertiesChanged', Lang.bind(this, function(arg) {
    	this._updateMetadata();
        this._updateSwitches();
        this._updatePlayPause();
        this._updateVolume();
        }));
	
	 },
	  
    _appPlayer: function(str) {
        PLAYER_DEFAULT = str;
        this._mediaServer = new MediaServer2Player();
        this._prop = new Prop();
    },

    _loadApp: function(app) {
        Main.overview.hide();
        Util.spawn([app]);
    },
    
    _createcover: function (pathToC) {
    	let coverA = new Clutter.Texture({
        	keep_aspect_ratio: true,
        	width: 150,
        	filename: pathToC});
    	this._songCover.set_child(coverA);
    },
    
    _updatePlayPause: function() {
        this._mediaServer.getPlaybackStatus(Lang.bind(this,
            function(sender, status) {
                if (status == "Playing")
                    this._mediaPlay.set_child(this._mediaPauseI);
                else if (status == "Paused" || status == "Stopped")
                    this._mediaPlay.set_child(this._mediaPlayI);
            }
        ));
    },
    
    _updateMetadata: function() {
        this._mediaServer.getMetadata(Lang.bind(this,
            function(sender, metadata) {
	        	if (DEFAULT_APP!="banshee-media-player.desktop") COVER_PATH=unescape(metadata["xesam:url"].substring(7,metadata["xesam:url"].lastIndexOf('/')))+ "/cover.jpg";
        		else COVER_PATH=metadata["mpris:artUrl"].substr(7,metadata["mpris:artUrl"].lenght);
				this._artist.text = metadata["xesam:artist"].toString() + ' - ' + metadata["xesam:title"].toString();
				this._album.text = metadata["xesam:album"].toString();
				this._createcover(COVER_PATH);
        	}));
    },
    
    _updateSwitches: function() {
        this._mediaServer.getShuffle(Lang.bind(this,
            function(sender, shuffle) {
                this._shuffle.setToggleState(shuffle);
            }
        ));
        this._mediaServer.getRepeat(Lang.bind(this,
            function(sender, repeat) {
                this._repeat.setToggleState(repeat);
            }
        ));
    },
    
    _updateVolume: function() {
        this._mediaServer.getVolume(Lang.bind(this,
        function(sender, volume) {
            global.log(this._volume_text);
        this._volume_text.setIcon = "audio-volume-low";
            if (volume > 0.30) {
            this._volume_text.setIcon = "audio-volume-medium";
        }
            if (volume > 0.70) {
            this._volume_text.setIcon = "audio-volume-high";
        }
            this._volume.setValue(volume);
        }
    ));
    }
};

function main(meta) {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('player');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['player'] = Indicator;
}
