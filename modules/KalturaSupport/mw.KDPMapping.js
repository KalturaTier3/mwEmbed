/*
 * Based on the 'kdp3 javascript api'
 * Add full kaltura mapping support to html5 based players
 * http://www.kaltura.org/demos/kdp3/docs.html#jsapi
 */
				
// scope in mw
( function( mw ) {
	mw.KDPMapping = function( ) {
		// Create a Player Manage
		return this.init();
	};
	mw.KDPMapping.prototype = {
		// global list of kdp listening callbacks
		listenerList: {},
		/**
		* Add Player hooks for supporting Kaltura api stuff
		*/ 
		init: function( ){
			if( mw.getConfig( 'EmbedPlayer.IsIframeServer' ) ){
				this.addIframePlayerHooksServer();
			} else {
				// For client side of the iframe add iframe hooks and player hooks ( will bind to 
				// different build player build outs and lets us support pages with both
				// iframe and no iframes players
				this.addIframePlayerHooksClient();
			}
			// Always add player hooks
			this.addPlayerHooks();
		},
		addPlayerHooks: function(){
			var _this = this;
			mw.log("KDPMapping::addPlayerHooks>");
			// Add the hooks to the player manager			
			$j( mw ).bind( 'newEmbedPlayerEvent', function( event, embedPlayer ) {
				// Add the addJsListener and sendNotification maps
				embedPlayer.addJsListener = function(listenerString, globalFuncName){
					_this.addJsListener( embedPlayer, listenerString, globalFuncName );
				};
				embedPlayer.removeJsListener = function(listenerString, callbackName){
					_this.removeJsListener( embedPlayer, listenerString, callbackName );
				};
				
				embedPlayer.sendNotification = function( notificationName, notificationData ){
					_this.sendNotification( embedPlayer, notificationName, notificationData);
				};
				
				embedPlayer.evaluate = function( objectString ){
					return _this.evaluate( embedPlayer, objectString);
				};
				
				// TODO per KDP docs this should be "attribute" but thats a protected native method. 
				// the emulation has to do something more tricky like listen to componentName changes 
				// in the attribute space!
				embedPlayer.setKDPAttribute = function( componentName, property, value ) {
					_this.setKDPAttribute( embedPlayer, componentName, property, value );
				};
				
				// Fire the KalturaKDPCallbackReady event with the player id: 
				if( window.deepLinkId ){
					window.KalturaKDPCallbackReady( embedPlayer.id );
				}
			});
		},
		
		/***************************************
		 * Client side kdp mapping iframe player setup: 
		 **************************************/	
		addIframePlayerHooksClient: function(){
			var _this = this;
			mw.log( "KDPMapping::addIframePlayerHooksClient" );

			$j( mw ).bind( 'AddIframePlayerMethods', function( event, playerMethods ){
				playerMethods.push( 'addJsListener', 'removeJsListener', 'sendNotification', 'setKDPAttribute' );
			});

			$j( mw ).bind( 'newIframePlayerClientSide', function( event, playerProxy ) {

				$j( playerProxy ).bind( 'jsListenerEvent', function(event, globalFuncName, listenerArgs){
					if( typeof window[ globalFuncName ] == 'function' ){
						window[ globalFuncName ].apply( this, listenerArgs );
					}
				});
				
				// Directly build out the evaluate call on the playerProxy
				playerProxy.evaluate = function( objectString ){
					return _this.evaluate( playerProxy, objectString);			
				};
				// Listen for the proxyReady event from the server: 
				$j( playerProxy ).bind( 'proxyReady', function(){
					if( window.KalturaKDPCallbackReady ){
						window.KalturaKDPCallbackReady( playerProxy.id );
					}
				});
			});			
		},
		
		/***************************************
		 * Server side kdp mapping iframe player setup: 
		 **************************************/
		addIframePlayerHooksServer: function(){
			var _this = this;
			mw.log("KDPMapping::addIframePlayerHooksServer");
			
			$j( mw ).bind( 'AddIframePlayerBindings', function( event, exportedBindings){
				exportedBindings.push( 'jsListenerEvent', 'Kaltura.SendAnalyticEvent' );
			});
			
			$j( mw ).bind( 'newIframePlayerServerSide', function( event, embedPlayer ){

				embedPlayer.addJsListener = function( eventName, globalFuncName){		
					var listenEventName = 'gcb_' + _this.getListenerId( embedPlayer, eventName, globalFuncName); 					
					window[ listenEventName ] = function(){
						// Check if the globalFuncName is defined on this side of the iframe and call it
						if( window[ globalFuncName ] && typeof window[ globalFuncName ] == 'function' ){
							window[ globalFuncName ].apply( this, $j.makeArray( arguments ) );
						}
						var args = [ globalFuncName, $j.makeArray( arguments ) ];
						$j( embedPlayer ).trigger( 'jsListenerEvent', args );
					};					
					_this.addJsListener( embedPlayer, eventName, listenEventName);
				};
				
				embedPlayer.removeJsListener = function( eventName, globalFuncName){
					var listenEventName = 'gcb_' + _this.getListenerId( embedPlayer, eventName, globalFuncName);
					_this.removeJsListener( embedPlayer, eventName, listenEventName );
				};
				
				// sendNotification method export: 
				embedPlayer.sendNotification = function( notificationName, notificationData ){
					_this.sendNotification( embedPlayer, notificationName, notificationData);
				};

				// setKDPAttribute method export:
				embedPlayer.setKDPAttribute = function( componentName, property, value ) {
					_this.setKDPAttribute( embedPlayer, componentName, property, value );
				};

			});
		},
		
		/*
		 * emulates kaltura setAttribute function
		 */
		setKDPAttribute: function( embedPlayer, componentName, property, value ) {
			mw.log(" cn: " + componentName + " p:" + property + " v:" + value);
			switch( property ) {
				case 'autoPlay':
					embedPlayer.autoplay = value;
				break;
				case 'mediaPlayFrom':
					embedPlayer.startTime = parseFloat(value);
				break;
				case 'mediaPlayTo':
					embedPlayer.endTime = parseFloat(value);
				break;
			}
		},
		
		/**
		 * emulates kaltura evaluate function
		 */
		evaluate: function( embedPlayer, objectString ){
			// If the first character is not a { directly return the string:
			if( objectString[0] != '{' ){
				return objectString;
			}
			// Strip the { } from the objectString
			objectString = objectString.replace( /\{|\}/g, '' );
			objectPath = objectString.split('.');
			switch( objectPath[0] ){
				case 'video':
					switch( objectPath[1] ){
						case 'volume': 
							return embedPlayer.volume;
						break;
						case 'player':
							switch( objectPath[2] ){
								case 'currentTime':
									return embedPlayer.currentTime;
								break;
							}
						break;
					}
				break;			
				case 'duration':
					return embedPlayer.duration;
					break;
				case 'mediaProxy':
					switch( objectPath[1] ){
						case 'entryMetadata':
							if( ! embedPlayer.kalturaEntryMetaData ){
								return null;
							}
							if( objectPath[2] ) {
								return embedPlayer.kalturaEntryMetaData[ objectPath[2] ];
							} else {
								return embedPlayer.kalturaEntryMetaData;
							}
						break;
						case 'entry':
							if( ! embedPlayer.kalturaPlayerMetaData ){
								return null;
							}
							if( objectPath[2] ) {
								return embedPlayer.kalturaPlayerMetaData[ objectPath[2] ];
							} else {
								return embedPlayer.kalturaPlayerMetaData;
							}
						break;
					}
				break;
				
				case 'configProxy':
					switch( objectPath[1] ){
						case 'flashvars':
							if( objectPath[2] ) {
								switch( objectPath[2] ) {
									case 'autoPlay':
										// get autoplay
										return embedPlayer.autoplay;
									break;
								}
							} else {
								// get flashvars
							}
						break;
					}
				break;	
				
				case 'playerStatusProxy':
					switch( objectPath[1] ){
						case 'kdpStatus': 
							//TODO
						break;
					}
				break;					
			}
		},
		
		/**
		 * Emulates kalatura addJsListener function
		 * @param {Object} EmbedPlayer the player to bind against
		 * @param {String} eventName the name of the event. 
		 * @param {Mixed} String of callback name, or function ref
		 */
		addJsListener: function( embedPlayer, eventName, callbackName ){
			var _this = this;
			mw.log("KDPMapping::addJsListener: " + eventName + ' cb:' + callbackName );

			if( typeof callbackName == 'string' ){
				this.listenerList[  this.getListenerId( embedPlayer, eventName, callbackName)  ] = window[ callbackName ];
				var callback = function(){
					var listnerId = _this.getListenerId( embedPlayer, eventName, callbackName) ;
					// Check that the listener is still valid and run the callback with supplied arguments
					if( _this.listenerList [ listnerId ] ){
						_this.listenerList [ listnerId ].apply( _this, $j.makeArray( arguments ) );
					}
				};
			} else if( typeof callbackName == 'function' ){
				// Make life easier for internal usage of the listener mapping by supporting
				// passing a callback by function ref
				var callback = callbackName;
			} else {
				mw.log( "Error: KDPMapping : bad callback type" );
				return ;
			}
			
			// Shortcut for embedPlayer bindings with postfix string ( so they don't get removed by other plugins ) 
			var b = function( bindName, bindCallback ){
				// add a postfix string
				bindName += '.kdpMapping';
				// remove any other kdpMapping binding:
				$j( embedPlayer ).bind( bindName, function(){
					bindCallback.apply( _this, $j.makeArray( arguments ) );
				});
			};
			switch( eventName ){
				case 'kdpEmpty':
					// TODO: When we have video tag without an entry
					break;
				case 'kdpReady':
					// TODO: When player is ready with entry, only happens once
					b( 'playerReady', function() {
						callback( {}, embedPlayer.id );
					});
					break;
				case 'volumeChanged': 
					b( 'volumeChanged', function(event, percent){
						callback( {'newVolume' : percent }, embedPlayer.id );
					});
					break;
				case 'playerStateChange':					
					// TODO add in other state changes
					b( 'pause', function(){
						callback( 'pause', embedPlayer.id );
					});
					
					b( 'onplay', function(){
						callback( 'onplay', embedPlayer.id );
					});
					
					break;
				case 'doStop':
				case 'stop':
					b( "doStop", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'playerPaused':
				case 'pause':
				case 'doPause':
					b( "pause", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'playerPlayed':
				case 'play':
				case 'doPlay':
					b( "onplay", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'doSeek':
				case 'playerSeekStart':
				case 'doIntelligentSeek':		
					b( "seeking", function(){
						callback( embedPlayer.currentTime, embedPlayer.id );
					});
					break;
				case 'playerSeekEnd':
					b( "seeked", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'playerPlayEnd':
					b("ended", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'durationChange': 
					b( "durationchange", function(){
						callback( { 'newValue' : embedPlayer.duration }, embedPlayer.id );
					});
				break;
				case 'openFullScreen': 
				case 'hasOpenedFullScreen':
					b( "onOpenFullScreen", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'hasCloseFullScreen':
				case 'closeFullScreen':
					b( "onCloseFullScreen", function(){
						callback( embedPlayer.id );
					});
					break;
				case 'playerUpdatePlayhead':
					b('monitorEvent', function(){
						callback( embedPlayer.currentTime,  embedPlayer.id );
					});
					break;	
				case 'entryReady':
					b( 'KalturaSupport_MetaDataReady', function( event, entryMetaData ) {
						callback( entryMetaData , embedPlayer.id );
					});
					break;
				case 'mediaReady':
					// check for "media ready" ( namespace to kdpMapping )
					b( 'playerReady', function() {
						callback( embedPlayer.id );
					});
					break;
				case 'cuePointsReceived':
					b( 'KalturaSupport_CuePointsReady', function( event, cuePoints ) {
						callback( embedPlayer.entryCuePoints, embedPlayer.id );
					});
					break;
				case 'cuePointReached':
					b( 'KalturaSupport_cuePointReached', function( event, cuePoint ) {
						callback( cuePoint, embedPlayer.id );
					});
					break;
				case 'adOpportunity':
					b( 'KalturaSupport_adOpportunity', function( event, cuePoint ) {
						callback( cuePoint, embedPlayer.id );
					});
					break;
				default:
					mw.log("Error unkown JsListener: " + eventName );
					return false;
			}	
			// if the event was successfully binded: 
			return true;
		},
		/**
		 * Emulates kaltura removeJsListener function
		 */
		removeJsListener: function( embedPlayer, eventName, callbackName ){
			var listenerId = this.getListenerId( embedPlayer, eventName, callbackName) ;
			mw.log("KDPMapping:: removeJsListener " + listenerId );
			this.listenerList [  listenerId ] = null;
		},
		
		// Generate an id for a listener based on embedPlayer, eventName and callbackName
		getListenerId: function(  embedPlayer, eventName, callbackName ){
			return embedPlayer.id + '_' + eventName + '_' + callbackName;
		},

		/**
		 * Master send action list: 
		 */
		sendNotification: function( embedPlayer, notificationName, notificationData ){
			switch( notificationName ){
				case 'doPlay':
					embedPlayer.play();
					break;
				case 'doPause':
					embedPlayer.pause();
					break;
				case 'doStop':
					embedPlayer.stop();
					break;
				case 'doSeek':
					// Kaltura doSeek is in seconds rather than percentage:
					var percent = parseFloat( notificationData ) / embedPlayer.getDuration();
					embedPlayer.doSeek( percent );
					break;
				case 'changeVolume':
					embedPlayer.setVolume( parseFloat( notificationData ) );
					// TODO the setVolume should update the interface
					embedPlayer.setInterfaceVolume(  parseFloat( notificationData ) );
					break;
				case 'cleanMedia':
					embedPlayer.emptySources();
					break;
				case 'changeMedia':
					// Check if we don't have entryId or it's -1. than we just empty the source and the metadata
					if( notificationData.entryId == "" || notificationData.entryId == -1 ) {
					    // Empty sources
					    embedPlayer.emptySources();
					    break;
					}

					var chnagePlayingMedia = embedPlayer.isPlaying();
					// Pause player during media switch
					embedPlayer.pause();

					// Reset first play to true, to count that play event
					embedPlayer.firstPlay = true;
					
					// Clear out any bootstrap data from the iframe 
					mw.setConfig('KalturaSupport.IFramePresetPlayerData', false);
					// Clear out any player error:
					embedPlayer['data-playerError'] = null;
					// Clear out the player error div:
					embedPlayer.$interface.find('.error').remove();
					// restore the control bar:
					embedPlayer.$interface.find('.control-bar').show();
					
					// Update the entry id
					embedPlayer.kentryid = notificationData.entryId;
					// Clear player & entry meta 
				    embedPlayer.kalturaPlayerMetaData = null;
				    embedPlayer.kalturaEntryMetaData = null;
					
					// Update the poster
					embedPlayer.updatePosterSrc( 
						mw.getKalturaThumbUrl({
							'partner_id': embedPlayer.kwidgetid.replace('_', ''),
							'entry_id' : embedPlayer.kentryid,
							'width' : embedPlayer.getWidth(),
							'height' :  embedPlayer.getHeight()
						})
					);
					embedPlayer.updatePosterHTML();
					
					// Add a loader to the embed player: 
					$j( embedPlayer )
					.getAbsoluteOverlaySpinner()
					.attr('id', embedPlayer.id + '_mappingSpinner' );
					
					if( embedPlayer.$interface ){
						embedPlayer.$interface.find('.play-btn-large').hide(); // hide the play btn
					}
									
					// Empty out embedPlayer object sources
					embedPlayer.emptySources();
					
					// Bind the ready state:
					$j( embedPlayer ).bind('playerReady.kdpMapping', function(){	
						// Do normal stop then play:
						if( chnagePlayingMedia ){
							// make sure the play button is not displayed:
							embedPlayer.$interface.find( '.play-btn-large' ).hide();
							if( embedPlayer.isPersistentNativePlayer() ){
								embedPlayer.switchPlaySrc( embedPlayer.getSrc() );
							} else {
								embedPlayer.stop();
								embedPlayer.play();	
							}
						}
					});
					
					// Load new sources per the entry id via the checkPlayerSourcesEvent hook:
					$j( embedPlayer ).triggerQueueCallback( 'checkPlayerSourcesEvent', function(){
						$j( '#' + embedPlayer.id + '_mappingSpinner' ).remove();
						if( embedPlayer.$interface ){
							embedPlayer.$interface.find( '.play-btn-large' ).show(); // show the play btn
						}
						embedPlayer.setupSourcePlayer();
					});
				break;
			}
		}
	};	
		
	// Setup the KDPMapping
	if( !window.KDPMapping ){
		window.KDPMapping = new mw.KDPMapping();
	}
	mw.log("KDPMapping::done ");
} )( window.mw );