(function() {
    //utility function to wait for some condition
    //this ends up being helpful as we toggle between a flow chart and a state diagram
    function when(condition, functionality) {
        var when_func = function() {
            if(condition.call()) {
                functionality.call();
            } else {
                setTimeout(when_func, 500);
            }
        };
        _.defer(when_func);
    }
    
    function randomString() {
		var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
		var string_length = 0x10;
		var randomstring = '';
		for (var i=0; i<string_length; i++) {
			var rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum,rnum+1);
		}
		return randomstring;
	}

	function roundNumber(num, dec) {
		return Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
	} 

	function humaneSize(fs) {
		if (fs >= 1073741824) { return roundNumber(fs / 1073741824, 2) + ' GB'; }
		if (fs >= 1048576)    { return roundNumber(fs / 1048576, 2) + ' MB'; }
		if (fs >= 1024)       { return roundNumber(fs / 1024, 0) + ' KB'; }
		return fs + ' B';
	}; 

	function create_torrent_filename(arg) {
		var paths = typeof arg === 'string' ? [arg] : arg;
		var default_path, filename;
		default_path = paths[0];
		filename = filename_from_filepath(default_path);
		if (paths.length > 1) {
			return remove_extension(filename) + '_and_others';
		} else {
			return filename;
		}
	};

	function remove_extension(filename) {
		var nameArray;
		nameArray = filename.split('.');
		if (nameArray.length > 1) {
			return _.first(nameArray, nameArray.length - 1).join('.');
		} else {
			return nameArray[0];
		}
	};

	function filename_from_filepath(filepath) {
		var filename;
		filename = _.last(filepath.split('\\'));
		return _.last(filename.split('/'));
	};


	function getArgs() {
		var searchString = document.location.search;

		// strip off the leading '?'
		searchString = searchString.substring(1);

		var nvPairs = searchString.split("&");
		var ret = {};
		for (i = 0; i < nvPairs.length; i++)
		{
		     var nvPair = nvPairs[i].split("=");
		     ret[nvPair[0]] = nvPair[1];
		}
		return ret;
	}

    function isMac() {
        return navigator.userAgent.match(/Macintosh/) != undefined;
    }		

    function isDeveloperMode() {
    	return false;
    }

	function isSupportedBrowser() {
		return !jQuery.browser.msie && !isMac();
	}

	function isBubbleDeletionSupported() {
		return false;
	}

	FileView = Backbone.View.extend({
		tagName: 'div',
		className: 'file',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.live('properties', _.bind(function(properties) {
				properties.on('change', this.render, this);
			}, this));
			this.options.bubble.trigger('bubble', '+');
			this.model.on('destroy', _.bind(function() {
				this.options.bubble.trigger('bubble', '-');
				this.remove();
			}, this));
			this.template = _.template($('#file_template').html());
			var torrent = this.options.bubble.btapp.get('torrent').get(this.model.get('torrent'));
			this.$el.data('torrent', torrent);
			this.$el.data('bubble', this.options.bubble);
			this.$el.draggable({
				revert: 'invalid',
				appendTo: 'body',
				helper: 'clone'
			});
		},
		render: function() {
			var hash = this.model.get('torrent');
			var torrents = this.options.bubble.btapp.get('torrent');
			var date = hash ? new Date(torrents.get(hash).get('properties').get('added_on') * 1000) : new Date;
			var properties = this.model.get('properties');
			var name = (properties && properties.has('name')) ? properties.get('name').replace(/^.*[\\\/]/, '') : '';
			var progress = (properties && properties.has('downloaded') && properties.has('size')) ? 100.0 * 
				properties.get('downloaded') / 
				properties.get('size') : 0;
			var size = (properties && properties.has('size')) ? properties.get('size') : 0;

			this.$el.html(this.template({
				name: name,
				progress: progress,
				file_size: humaneSize(size),
				file_date: humaneDate(date)
			}));
			return this;
		}
	});

	BubbleContentsView = Backbone.View.extend({
		tagName: 'div',
		className: 'contents',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
			this.model.on('show', function() {
				this.$el.show();
			}, this);
			this.model.on('hide', function() {
				this.$el.hide();
			}, this);
			
			this.model.btapp.live('torrent * file *', function(file) {
				var view = new FileView({
					model: file,
				 	bubble: this.model
				 });
				this.$el.append(view.render().el);
			}, this);
		}
	});

	BadgeView = Backbone.View.extend({
		tagName: 'span',
		className: 'badge',
		initialize: function() {
			this.count = 0;
			this.model.live('torrent * file *', _.bind(function(file) {
				this.count++;
				this.render();
				file.on('destroy', _.bind(function() {
					this.count--;
					this.render();
				}, this));
			}, this));
			this.model.live('torrent', _.bind(function() {
				this.$el.addClass('badge-info');
				this.render();
			}, this));
			this.model.on('remove:torrent', _.bind(function() {
				this.$el.removeClass('badge-info');
				this.render();
			}, this));
		},
		render: function() {
			this.$el.empty();
			if(!this.$el.hasClass('badge-info')) {
				this.$el.text('-');
			} else {
				this.$el.text(this.count);
			}
			return this;
		}		
	});

	BubbleView = Backbone.View.extend({
		tagName: 'div',
		className: 'bubble user_bubble',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);

			this.model.on('bubble', _.bind(function(text) {
				var notice = $('<span class="badge badge-info">' + text + '</span>');
				notice.floatAway().appendTo(this.$el);
			}, this));

			var i = this.model.get('position');
			//size relationshipt of the container and the bubbles
			//r = radius of each bubble
			//R = radius of the container
			//r = (R * pi) / (16 + pi)
			var angle = (i - 3.75) / 7.5 * Math.PI;
			var x = 255 * Math.cos(angle) + 310;
			var y = 255 * Math.sin(angle) + 310;

			this.$el.css('left', x + 'px');
			this.$el.css('top', y + 'px');

			this.badge = new BadgeView({model: this.model.btapp});

			this.model.on('show', function() {
				this.$el.addClass('selected');
			}, this);
			this.model.on('hide', function() {
				this.$el.removeClass('selected');
			}, this);


			this.$el.click(_.bind(function() {
				this.model.collection.each(function(model) {
					if(this.model !== model) {
						model.trigger('hide');
					}
				}, this);
				this.model.trigger('show');
			}, this));

			if(isBubbleDeletionSupported() && this.model.get('draggable')) {
				this.$el.data('bubble', this.model);
				this.$el.draggable({
					revert: 'invalid',
					appendTo: 'body',
					helper: 'clone'
				});
			}

			this.$el.droppable({
				tolerance: 'pointer',
				greedy: 'true',
				accept: _.bind(function(draggable) {
					// Only allow drops of torrents
					if(!draggable.data('bubble') || !draggable.data('torrent')) {
						return;
					}

					var addable = this.model.btapp.has('add');
					var duplicate = this.model.btapp.has('torrent') && this.model.btapp.get('torrent').get(draggable.data('torrent'));
					return addable && !duplicate;
				}, this),
				hoverClass: 'ui-state-hover hover',
				activeClass: 'ui-state-active',
				drop: _.bind(function(event, ui) {
					var draggable = ui.draggable;
					// Only allow drops of torrents
					if(!draggable.data('bubble') || !draggable.data('torrent')) {
						return;
					}

					this.model.trigger('bubble', '+');
					var uri = draggable.data('torrent').get('properties').get('uri');
					this.model.btapp.get('add').torrent(uri).then(function() {
						console.log('torrent added');
					});
				}, this)
			});
		},
		render: function() {
			this.$el.empty();
			var name = $('<p></p>');
			name.text(this.model.get('label'));
			this.$el.append(name);
			this.$el.append(this.badge.render().el);
			return this;
		}
	});

	Bubble = Backbone.Model.extend({
		initialize: function() {
			if(this.has('btapp')) {
				this.btapp = this.get('btapp');
			} else {
				this.btapp = new Btapp;
				this.btapp.connect(_.extend(this.get('credentials'), {
					poll_frequency: 1000
				}));
			}
		}
	});

	Bubbles = Backbone.Collection.extend({
		model: Bubble
	});

	WelcomeNameView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_name_frame welcome_frame',
		events: {
			'click .btn-primary': 'click',
			'submit': 'click'
		},
		initialize: function() {
			this.template = _.template($('#welcome_name_template').html());
		},
		render: function() {
			this.$el.html(this.template({}));
			return this;
		},
		click: function(event) {
			event.stopPropagation();
			event.preventDefault();
			var name = this.$('input').val();
			if(name.length > 0) {
				jQuery.jStorage.set('name', name);
				this.remove();
				this.model.trigger('next');
			} else {

			}
		}
	});

	WelcomeInstallView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_install_frame welcome_frame',
		initialize: function() {
			this.$el.hide();
			this.template = _.template($('#welcome_install_template').html());
            this.plugin_manager = new PluginManager();
            this.plugin_manager.on('plugin:client_running', _.bind(function() {
            	this.remove();
            	this.model.trigger('next');
            }, this));
            this.plugin_manager.on('plugin:install_plugin', _.bind(function() {
            	this.$el.show();
            }, this));
		},
		render: function() {
			this.$el.html(this.template({
				name: jQuery.jStorage.get('name'),
				url: this.plugin_manager.get('download_url')
			}));
			return this;
		}
	});

	WelcomeExplainationView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_explanation_frame welcome_frame',
		events: {
			'click .btn-primary': 'click',
			'submit': 'click'
		},
		initialize: function() {
			this.template = _.template($('#welcome_explaination_template').html());
		},
		render: function() {
			this.$el.html(this.template({
				friend: getArgs()['name'],
				name: jQuery.jStorage.get('name')
			}));
			return this;
		},
		click: function() {
			this.remove();
			this.model.trigger('next');
		}
	});

	function setupRemote(btapp) {
		//make sure that we have credentials available
		if(!jQuery.jStorage.get('username')) {
			jQuery.jStorage.set('username', randomString());
		}
		if(!jQuery.jStorage.get('password')) {
			jQuery.jStorage.set('password', randomString());
		}
		var username = jQuery.jStorage.get('username');
		var password = jQuery.jStorage.get('password');
		when(function() {
				return typeof btapp.connect_remote !== 'undefined' && btapp.has('settings');
			}, function() {
				var connected = btapp.get('settings').get('webui.uconnect_enable') === 'true';
				var matching = btapp.get('settings').get('webui.uconnect_username') === username;
				if(!connected || !matching) {
					console.log('connect_remote(' + username + ',' + password + ')');
					btapp.connect_remote(username, password);
				} else {
					console.log('already connected as ' + username);
				}
			}
		);
	}

	function setupAddBubble(btapp) {
		$('.add_bubble').click(function() {
			if(typeof btapp.browseforfiles === 'undefined') return;
			btapp.browseforfiles(function(files) {
				if(typeof btapp.create === 'undefined') return;
				_.each(files, function(value, key) {
					btapp.create(create_torrent_filename(value), [value], function() {
						console.log('created');
					}).then(function() { console.log('called create')});
				});
			}).then(function() { console.log('called browseforfiles')});
		});
	}

	function setupRemoveBubble(btapp) {
		$('.remove_bubble').droppable({
			accept: _.bind(function(draggable) {
				// Only allow drops of torrents
				if(!draggable.data('bubble')) {
					return false;
				}
				//is it a torrent or a bubble
				var torrent = draggable.data('torrent');
				if(torrent) {
					return typeof torrent.remove !== 'undefined';
				} else {
					return draggable.data('bubble').btapp !== btapp;
				}
			}, this),
			tolerance: 'pointer',
			hoverClass: 'ui-state-hover hover',
			activeClass: 'ui-state-active',
			drop: _.bind(function(event, ui) {
				var torrent = ui.draggable.data('torrent');
				if(torrent) {
					torrent.remove();
					ui.draggable.data('bubble').trigger('bubble', '-');
				} else {
					//lets destroy this user
				}
			}, this)
		});
	}

	function setupComputerBubble(btapp) {
		$('.computer_bubble').droppable({
			accept: _.bind(function(draggable) {
				// Only allow drops of torrents
				if(!draggable.data('bubble') || !draggable.data('torrent')) {
					return;
				}

				// Only open files that are ours.
				if(draggable.data('bubble').btapp !== btapp) {
					return false;
				}
				var torrent = draggable.data('torrent');
				return torrent && typeof torrent.remove !== 'undefined';
			}, this),
			tolerance: 'pointer',
			hoverClass: 'ui-state-hover hover',
			activeClass: 'ui-state-active',
			drop: _.bind(function(event, ui) {
				var torrent = ui.draggable.data('torrent');
				torrent.open_containing();
			}, this)
		});
	}

	function setupSocialBubbles() {
		//twitter
		(function() {
			var link = 'http://paddleover.com?name=' + jQuery.jStorage.get('name') + '&cu=' + jQuery.jStorage.get('username') + '&cp=' + jQuery.jStorage.get('password');
			var text = 'Drag files from my computer to yours, and visa versa using #PaddleOver.'
			$('.twitter_bubble').attr('href', 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(link) + '&text=' + text);
		}());

		//facebook
		$('.fb_bubble').click(function() {
			var link = 'http://paddleover.com?name=' + jQuery.jStorage.get('name') + '&cu=' + jQuery.jStorage.get('username') + '&cp=' + jQuery.jStorage.get('password');
			var text = 'Drag files from my computer to yours, and visa versa.'
			var description = 'Let friends add files to your computer, and do the same for them. Works both ways too, so you can take what you want!';
			FB.init({appId: '353964634659536', xfbml: true, cookie: true});
			FB.ui({
				method: 'send',
				picture: 'http://paddleover.com/images/icon.png',
				description: description,
				name: text,
				link: link
			});
		});		
	}

	function displayWelcome(callback) {
		var namemodel = new Backbone.Model;
		var installmodel = new Backbone.Model;
		var explainationmodel = new Backbone.Model;

		var welcomenameview = new WelcomeNameView({model: namemodel});
		$('body').append(welcomenameview.render().el);

		var show_install = function() {
			var welcomeinstallview = new WelcomeInstallView({model: installmodel});
			$('body').append(welcomeinstallview.render().el);
		};
		var show_explaination = function() {
			var welcomeexplainationview = new WelcomeExplainationView({model: explainationmodel});
			$('body').append(welcomeexplainationview.render().el);
		};

		namemodel.on('next', show_install);
		installmodel.on('next', show_explaination);
		explainationmodel.on('next', callback);
	}

	function addDefaultBubble(bubbles, user, torrents) {
		var bubble = new Bubble({
			id: 'default',
			btapp: new Backbone.Model({
				torrent: new Backbone.Collection()
			}),
			label: user,
			position: bubbles.length,
			draggable: true
		});
		_.each(torrents, function(torrent) {
			var name = torrent.name;
			var uri = torrent.uri;
			var size = torrent.size;
			var hash = torrent.hash;
			bubble.btapp.get('torrent').add(
				new Backbone.Model({
					id: hash,
					file: new Backbone.Collection([
						new Backbone.Model({
							id: 'Counting%20Crows%20-%20Underwater%20Sunshine%20-%20Liner%20Notes.pdf',
							torrent: hash,
							properties: new Backbone.Model({
								name: name,
								size: size,
								downloaded: size
							})
						}),
					]),
					properties: new Backbone.Model({
						uri: uri,
						added_on: (new Date()).getTime() / 1000
					})
				})
			);
		});
		bubbles.add(bubble);
		bubble.trigger('hide');
	}

	jQuery(function() {
		if(!isSupportedBrowser()) {
			$('.not_supported').show();
			return;
		}

		var bubbles = new Bubbles;
		bubbles.on('add', function(bubble) {
			var view = new BubbleView({model: bubble});
			$('.bubble_container').append(view.render().el);

			var contents = new BubbleContentsView({model: bubble});
			contents.$el.hide();
			$('.bubble_center').append(contents.render().el);
		});

		function start() {
			var self = new Bubble({
				id: jQuery.jStorage.get('username'),
				credentials: { },
				label: jQuery.jStorage.get('name'),
				position: 0,
				draggable: false
			});
			window.btapp = self.btapp;
			setupRemote(self.btapp);
			bubbles.add(self);
			self.trigger('show');
			$('.social_bubble, .add_user, .add_bubble, .bubble_container, .navbar, .banner, .remove_bubble, .computer_bubble').show();
			if(!isDeveloperMode()) {
				$('.navbar-fixed-top a').hide();
				$('.navbar-fixed-bottom span').hide();
				$('.banner').hide();
			}
			setupAddBubble(self.btapp);
			setupRemoveBubble(self.btapp);
			setupComputerBubble(self.btapp);
			setupSocialBubbles();


			addDefaultBubble(
				bubbles,
				'Kyle', 
				[
					{
						uri: 'http://torrage.com/torrent/A92308E3D21698B7EFBD6F0C1024BBFC1AB69C0E.torrent',
						hash: 'a92308e3d21698b7efbd6f0c1024bbfc1ab69c0e',
						name: '80_Proof_Bundle',
						size: 300145610
					},
					{
						uri: 'http://featuredcontent.utorrent.com/torrents/CountingCrows-BitTorrent.torrent',
						hash: '2110C7B4FA045F62D33DD0E01DD6F5BC15902179',
						name: 'Counting_Crows_Bundle', 
						size: 29661352
					},
					{
						uri: 'http://featuredcontent.utorrent.com/torrents/DeathGrips-BitTorrent.torrent', 
						hash: 'F094C7473B68ED9777C7331B785586CCDD5301C7',
						name: 'Death_Grips_Bundle', 
						size: 633972503
					},
					{
						uri: 'http://apps.bittorrent.com/torrents/PrettyLights-Bittorrent.torrent', 
						hash: 'EE3EB1ACEC1DC7ADC73EDA16D05A495BEA1DD4BE',
						name: 'Pretty_lights_Bundle', 
						size: 383133030
					}
				]
			);

			// Start each stash key with an identifier
			var prefix = 'paddle-';
			function add_friend(name, username, password) {
				//do we already have a friend entry for this account?
				if(bubbles.get(username)) return;

				var friend = new Bubble({
					id: username,
					credentials: {
						username: username,
						password: password
					},
					label: name,
					position: bubbles.length,
					draggable: true
				});
				friend.btapp.on('add:stash', function(stash) {
					store_in_stash(jQuery.jStorage.get('name'), jQuery.jStorage.get('username'), jQuery.jStorage.get('password'), stash);
				});
				
				bubbles.add(friend);
			}
			function store_in_stash(name, username, password, stash) {
				var attributes = {};
				attributes[prefix + username] = JSON.stringify({
					name: name,
					username: username,
					password: password
				});
				stash.save(attributes);
			}
			function add_friend_from_stash(value, key) {
				if(key.indexOf(prefix) === 0) {
					var name = JSON.parse(value).name;
					var username = key.replace(prefix, '');
					var password = JSON.parse(value).password;
					add_friend(name, username, password)
				}
			}
			//add the friend if there was one provided as url args
			var args = getArgs();
			if('name' in args && 'cu' in args && 'cp' in args) {
				self.btapp.on('add:stash', function(stash) {
					store_in_stash(args.name, args.cu, args.cp, stash);
					add_friend(args.name, args.cu, args.cp);
				});
			}

			// Because friends are potentially adding their credentials to your stash, 
			// we need to check there for bubbles that we haven't yet added.
			self.btapp.on('add:stash', function(stash) {
				_(stash.toJSON()).each(add_friend_from_stash);
				stash.on('add', add_friend_from_stash);
			});

			jQuery.jStorage.set('welcomed', true);
		}

		if(jQuery.jStorage.get('welcomed') === true) {
			start();
		} else {
			displayWelcome(start);
		}
		$('.auto-focus:first').focus();

		// Add in our easter egg
		$('#boat_trigger').click(function() {
			$('#boat, #clouds').addClass('move');
		});
		// Add a flame as an easter egg
		$('#flame_trigger').click(function() {
			$('#flame').toggle();
		});
	});
}).call(this);