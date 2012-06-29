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
    	return true;
    }

	function isSupportedBrowser() {
		return !jQuery.browser.msie;
	}

	function isBubbleDeletionSupported() {
		return false;
	}

	function getDefaultBubbleName() {
		return 'Patrick';
	}

	function getQueries() {
		return [
			'btapp/torrent/all/*/remove/',
			'btapp/torrent/all/*/open_containing/',
			'btapp/torrent/all/*/file/', 
			'btapp/torrent/all/*/properties/', 
			'btapp/browseforfiles/',
			'btapp/create/', 
			'btapp/settings/', 
			'btapp/add/',
			'btapp/events/',
			'btapp/connect_remote/',
			'btapp/stash/',
			'btapp/showview/'
		];
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
			this.$el.data('torrent', this.model);
			this.$el.data('bubble', this.options.bubble);
			this.$el.draggable({
				revert: 'invalid',
				appendTo: 'body',
				helper: 'clone',
				zIndex: 100
			});
		},
		render: function() {
			var properties = this.model.get('properties');
			var date = properties ? new Date(properties.get('added_on') * 1000) : new Date;
			var name = (properties && properties.has('name')) ? properties.get('name').replace(/^.*[\\\/]/, '') : '';
			var progress = properties ? (properties.get('progress') / 10.0) : 0;
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
			
			this.model.btapp.live('torrent *', function(file) {
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
			this.model.live('torrent *', _.bind(function(file) {
				this.count++;
				this.render();
				file.on('destroy', _.bind(function() {
					this.count--;
					this.render();
				}, this));
			}, this));
			this.model.on('change', this.render, this);
		},
		render: function() {
			this.$el.empty();
			if(this.model.connected_state) {
				this.$el.text(this.count);
				this.$el.addClass('badge-info');
			} else {
				this.$el.text('-');
				this.$el.removeClass('badge-info');
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
			if(this.model.has('title')) {
				this.$el.attr('title', this.model.get('title'));
			}
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
					poll_frequency: 1000,
					queries: getQueries()
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

	WelcomeBubbleExplanationView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_bubble_explanation_frame welcome_frame',
		initialize: function() {
			this.template = _.template($('#welcome_explaination_bubble_template').html());
			this.success_template = _.template($('#welcome_explaination_bubble_success_template').html());
			this.options.bubbles.at(1).on('show', this.test_friend_selected, this);
		},
		render: function() {
			$('.bubble_container').addClass('above_welcome_overlay');
			this.$el.html(this.template({
				name: getDefaultBubbleName()
			}));
			return this;
		},
		on_torrent_list: function() {
			this.options.bubbles.at(0).btapp.off('torrent', this.on_torrent_list, this);
			this.torrent_list();
		},
		torrent_list: function() {
			if(this.options.bubbles.at(0).btapp.get('torrent').length > 0) {
				this.torrent();
			} else {
				this.options.bubbles.at(0).btapp.get('torrent').on('add', this.torrent, this);
			}
		},
		on_torrent: function() {
			this.options.bubbles.at(0).btapp.get('torrent').off('add', this.torrent, this);
			this.torrent();
		},
		test_friend_selected: function() {
			this.options.bubbles.at(1).off('show', this.test_friend_selected, this);
			if(this.options.bubbles.at(0).btapp.has('torrent')) {
				this.torrent_list();
			} else {
				this.options.bubbles.at(0).btapp.on('add:torrent', this.on_torrent_list, this);
			}
		},
		torrent: function() {
			this.remove();
			this.model.trigger('next');
		}
	});

	WelcomeBubbleExplanationSuccessView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_bubble_explanation_frame welcome_frame',
		initialize: function() {
			this.template = _.template($('#welcome_explaination_bubble_success_template').html());
		},
		render: function() {
			$('.bubble_container').addClass('above_welcome_overlay');
			this.$el.html(this.template({}));
			setTimeout(_.bind(this.done, this), 7500);
			return this;
		},
		done: function() {
			this.remove();
			this.model.trigger('next');
			$('.bubble_container').removeClass('above_welcome_overlay');
		}
	});


	EasterEggView = Backbone.View.extend({
		initialize: function() {
			// Add in our easter egg
			$('#boat_trigger').click(function() {
				$('#boat').addClass('move');
			});
			// Add a flame as an easter egg
			$('#flame_trigger').click(function() {
				$('#flame').toggle();
			});
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
				files = _.values(files);
				if(typeof btapp.create === 'undefined') return;
				if(files.length === 0) return;
				btapp.create(create_torrent_filename(files), files, function() {
					console.log('created');
				}).then(function() { console.log('called create')});
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
				return torrent && typeof torrent.open_containing !== 'undefined';
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
		var link = 'http://paddleover.com?name=' + jQuery.jStorage.get('name') + '&cu=' + jQuery.jStorage.get('username') + '&cp=' + jQuery.jStorage.get('password');
		//twitter
		(function() {
			var text = 'Drag files from my computer to yours, and visa versa using #PaddleOver.'
			$('.twitter_bubble').attr('href', 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(link) + '&text=' + text);
		}());

		//facebook
		$('.fb_bubble').click(function() {
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

		//email
		(function() {
			var subject = 'I\'m sharing files with PaddleOver';
			var body = 'PaddleOver lets friends add files to your computer, and do the same for them. Works both ways too, so you can take what you want! I\'m using it right now. Join me!';
			$('.email_bubble').attr('href', 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + '%0D%0A%0D%0A' + encodeURIComponent(link));
		}());
	}

	function displayWelcome(start) {
		$('.welcome_overlay').show();
		var namemodel = new Backbone.Model;
		var installmodel = new Backbone.Model;
		var bubbleexplanationmodel = new Backbone.Model;
		var bubbleexplanationsuccessmodel = new Backbone.Model;

		var welcomenameview = new WelcomeNameView({model: namemodel});
		$('body').append(welcomenameview.render().el);
		$('.auto-focus:visible:first').focus();

		var show_install = function() {
			var welcomeinstallview = new WelcomeInstallView({model: installmodel});
			$('body').append(welcomeinstallview.render().el);
		};
		var show_bubble_explanation = function() {
			var bubbles = start();
			var welcomebubbleexplanationview = new WelcomeBubbleExplanationView({
				model: bubbleexplanationmodel,
				bubbles: bubbles
			});
			$('body').append(welcomebubbleexplanationview.render().el);
		}
		var show_bubble_explanation_success = function() {
			var bubbleexplanationsuccessview = new WelcomeBubbleExplanationSuccessView({
				model: bubbleexplanationsuccessmodel
			});
			$('body').append(bubbleexplanationsuccessview.render().el);	
		}

		namemodel.on('next', show_install);
		installmodel.on('next', show_bubble_explanation);
		bubbleexplanationmodel.on('next', show_bubble_explanation_success);
		bubbleexplanationsuccessmodel.on('next', function() {
			$('.welcome_overlay').fadeOut();
		});
	}

	function addDefaultBubble(bubbles) {
		var user = getDefaultBubbleName(); 
		var torrents = [
			{
				uri: 'http://torrage.com/torrent/A92308E3D21698B7EFBD6F0C1024BBFC1AB69C0E.torrent',
				hash: 'a92308e3d21698b7efbd6f0c1024bbfc1ab69c0e',
				name: '80 Proof - BitTorrent Edition',
				size: 300145610
			},
			{
				uri: 'http://featuredcontent.utorrent.com/torrents/CountingCrows-BitTorrent.torrent',
				hash: '2110C7B4FA045F62D33DD0E01DD6F5BC15902179',
				name: 'CountingCrows-BitTorrent', 
				size: 29661352
			},
			{
				uri: 'http://featuredcontent.utorrent.com/torrents/DeathGrips-BitTorrent.torrent', 
				hash: 'F094C7473B68ED9777C7331B785586CCDD5301C7',
				name: 'DeathGrips-BitTorrent', 
				size: 633972503
			},
			{
				uri: 'http://apps.bittorrent.com/torrents/PrettyLights-Bittorrent.torrent', 
				hash: 'EE3EB1ACEC1DC7ADC73EDA16D05A495BEA1DD4BE',
				name: 'PrettyLights-BT', 
				size: 383133030
			}
		];
		var bubble = new Bubble({
			id: 'default',
			title: getDefaultBubbleName() + ' is here to get you started. He tends to really enjoy BitTorrent Featured Artists. Unlike your other PaddleOver friends, you won\'t be able to delete ' + getDefaultBubbleName() + '\'s content.',
			btapp: new Backbone.Model({
				torrent: new Backbone.Collection()
			}),
			label: user,
			position: bubbles.length,
			draggable: true
		});
		bubble.btapp.connected_state = true;
		_.each(torrents, function(torrent) {
			var name = torrent.name;
			var uri = torrent.uri;
			var size = torrent.size;
			var hash = torrent.hash;
			bubble.btapp.get('torrent').add(
				new Backbone.Model({
					id: hash,
					properties: new Backbone.Model({
						uri: uri,
						added_on: (new Date()).getTime() / 1000,
						name: name,
						size: size,
						progress: 1000
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
			addDefaultBubble(bubbles);

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
					store_credentials_in_stash(jQuery.jStorage.get('name'), jQuery.jStorage.get('username'), jQuery.jStorage.get('password'), stash);
				});
				
				bubbles.add(friend);
			}
			function store_credentials_in_stash(name, username, password, stash) {
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
					store_credentials_in_stash(args.name, args.cu, args.cp, stash);
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

			return bubbles;
		}

		if(jQuery.jStorage.get('welcomed') === true) {
			start();
		} else {
			displayWelcome(start);
		}
		new EasterEggView();
	});
}).call(this);