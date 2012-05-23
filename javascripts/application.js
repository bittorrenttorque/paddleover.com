(function() {
	BubbleContentsView = Backbone.View.extend({
		initialize: function() {
			this.template = _.template($('#content_template').html());
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
		},
		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			return this;
		}
	});

	BadgeView = Backbone.View.extend({
		tagName: 'span',
		className: 'badge badge-info',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
		},
		render: function() {
			this.$el.empty();
			console.log('render:' + this.model.length);
			this.$el.text(this.model.length);
			return this;
		}		
	});

	BubbleView = Backbone.View.extend({
		tagName: 'div',
		className: 'bubble user_bubble',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);

			var i = this.model.get('position');
			//size relationshipt of the container and the bubbles
			//r = radius of each bubble
			//R = radius of the container
			//r = (R * pi) / (16 + pi)
			var angle = (i - 4) / 8.0 * Math.PI;
			var x = 250 * Math.cos(angle) + 300;
			var y = 250 * Math.sin(angle) + 300;

			this.$el.css('left', x + 'px');
			this.$el.css('top', y + 'px');

			this.model.get('btapp').on('add:torrent', function(torrents) {
				var badge = new BadgeView({model: torrents});
				this.$el.append(badge.render().el);
			}, this);
		},
		render: function() {
			this.$el.empty();
			this.$el.append(this.model.get('label'));
			return this;
		}
	});

	jQuery(function() {
		var bubbles = new Backbone.Collection;
		bubbles.on('add', function(bubble) {
			var view = new BubbleView({model: bubble});
			view.$el.show();
			$('.bubble_container').append(view.render().el);
		});

		$('.add_bubble').click(function() {
			var bubble = new Bubble({position: bubbles.length});
			bubbles.add(bubble);
		});

		var btapp = new Btapp;
		btapp.connect();
		bubbles.add({
			btapp: btapp,
			label: 'Self',
			position: 0
		});
	});
}).call(this);