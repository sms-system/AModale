(function() {
	var bodyLocker = {
		lock: function () {
			var oWidth = parseInt(document.body.style.marginLeft||0) +
				parseInt(document.body.style.marginRight||0) +
				document.body.offsetWidth
			document.body.style.overflow = 'hidden'
			var sbWidth = parseInt(document.body.style.marginLeft||0) +
				parseInt(document.body.style.marginRight||0) +
				document.body.offsetWidth -
				oWidth

			if (sbWidth !== 0) {
				document.documentElement.style.marginRight = sbWidth + 'px'
			}
		},
		unlock: function () {
			document.documentElement.style.marginRight = ''
			document.body.style.overflow = ''
		}
	}
	function $$(selector, context) {
		return Array.prototype.slice.call((context || document).querySelectorAll(selector))
	}
	function getFocusableChildren(el) {
		var focusableElements =
			'a[href],' +
			'area[href],' +
			'input:not([disabled]),' +
			'select:not([disabled]),' +
			'textarea:not([disabled]),' +
			'button:not([disabled]),' +
			'iframe,' +
			'object,' +
			'embed,' +
			'[contenteditable],' +
			'[tabindex]:not([tabindex^="-"])'
		return $$(focusableElements, el).filter(function (child) {
			return !!(child.offsetWidth || child.offsetHeight || child.getClientRects().length)
		})
	}
	var transitionDefs = (function() {
		var el = document.createElement('fakeelement')
		var transitionEventType = 'transitionend'
		var transitionAttribute = 'transition'
		var transitionEventTypes = {
			'WebkitTransition' : 'webkitTransitionEnd',
			'MozTransition'    : 'transitionend',
			'OTransition'      : 'oTransitionEnd otransitionend',
			'transition'       : 'transitionend'
		}
		Object.keys(transitionEventTypes).forEach(function(t) {
			if(el.style[t] !== undefined ) {
				transitionEventType = transitionEventTypes[t]
				transitionAttribute = t
			}
		})
		return [transitionAttribute, transitionEventType]
	})()
	var transitionAttribute = transitionDefs[0]
	var transitionEvent = transitionDefs[1]

	function trapTabKey(node, event) {
		var focusableChildren = getFocusableChildren(node)
		var focusedItemIndex = focusableChildren.indexOf(document.activeElement)

		if (focusableChildren.length === 0) {
			event.preventDefault()
		} else if (event.shiftKey && focusedItemIndex === 0) {
			focusableChildren[focusableChildren.length - 1].focus()
			event.preventDefault()
		} else if (!event.shiftKey && focusedItemIndex === focusableChildren.length - 1 || focusedItemIndex === -1) {
			focusableChildren[0].focus()
			event.preventDefault()
		}
	}
	function hasTransition(el) {
		// Detect if transition isset
		var transitionTimes = (getComputedStyle(el)[transitionAttribute]||'').match(/[0-9.]+/g)||[]
		var transitionTimeSum = 0
		transitionTimes.forEach(function(time){
			transitionTimeSum += time*1
		})
		return transitionTimeSum !== 0
	}
	function trimStackRight() {
		var l = stack.length
		while (stack[--l] === undefined && l >= 0) {
			stack.pop()
		}
	}
	function getElement(modal) {
		var el = document.getElementById(modal.id())
		if (!el) throw new Error('DOM Element with id "' + modal.id() + '" not found')
		return el
	}

	var keydownListeners = {}
	var focusListeners = {}
	var previouslyFocusedElements = {}
	var indexes = {}
	var isShown = {}
	var afterOpenCallback = function(){}
	var afterCloseCallback = function(){}
	var stack = []

	Modal = function(id, config) {
		var modal = this
		var defaultConfig = {
			closeOnESC: true,
			closeOnOverlayClick: true,
			beforeOpen: function(){},
			beforeClose: function(){},
			afterOpen: function(){},
			afterClose: function(){}
		}
		var config = config || {}
		isShown[id] = false
		this.config = function(attr) {
			return config[attr] !== undefined ? config[attr] : defaultConfig[attr]
		}
		this.id = function() {
			return id
		}
		var el = getElement(this)

		el.setAttribute('tabindex', 0)
		$$('[href="#' + id + '"]').forEach(function(openButton) {
			openButton.addEventListener('click', function(event) {
				event.preventDefault()
				modal.open()
			})
		})
		$$('[href="#main"]', el).forEach(function(closeButton) {
			closeButton.addEventListener('click', function(event) {
				event.preventDefault()
				modal.close()
			})
		})
		el.addEventListener('click', function(event) {
			if (modal.config('closeOnOverlayClick') && event.target.isEqualNode(el)) {
				event.preventDefault()
				modal.close()
			}
		})
		keydownListeners[modal.id()] = function(event) {
			if (modal.config('closeOnESC') && event.which === 27) {
				event.preventDefault()
				modal.close()
			}
			if (event.which === 9) {
				trapTabKey(el, event)
			}
		}
		focusListeners[modal.id()] = function (event) {
			var focusableChildren = getFocusableChildren(el)
			if (!el.contains(event.target) && focusableChildren.length) {
				getFocusableChildren(el)[0].focus()
			}
		}
	}
	Modal.prototype = {
		open: function() {
			var beforeOpen = this.config('beforeOpen')
			var afterOpen = this.config('afterOpen')
			var modal = this
			if (!isShown[this.id()] && beforeOpen.call(modal) !== false) {
				if (!stack.length) bodyLocker.lock()
				isShown[this.id()] = true
				var el = getElement(this)
				el.scrollTop = 0

				if (stack.length) {
					var previousModal = stack[stack.length - 1]
					document.body.removeEventListener('focus', focusListeners[previousModal.id()], true)
					document.removeEventListener('keydown', keydownListeners[previousModal.id()], true)
					getElement(previousModal).setAttribute('aria-hidden', true)
				} else {
					document.getElementById('main').setAttribute('aria-hidden', true)
				}
				stack.push(this)
				indexes[this.id()] = stack.length - 1
				el.style.zIndex = stack.length - 1

				el.removeEventListener(transitionEvent, afterCloseCallback)

				el.removeAttribute('hidden')
				el.removeAttribute('aria-hidden')
				// Remember previously focused element
				previouslyFocusedElements[this.id()] = document.activeElement

				document.body.addEventListener('focus', focusListeners[this.id()], true)
				document.addEventListener('keydown', keydownListeners[this.id()], true)

				afterOpenCallback = function() {
					el.removeEventListener(transitionEvent, afterOpenCallback)
					el.focus()
					afterOpen.call(modal)
				}
				if (hasTransition(el)) {
					el.addEventListener(transitionEvent, afterOpenCallback)
				} else {
					afterOpenCallback()
				}
				return true
			} else {
				return false
			}
		},
		close: function() {
			var beforeClose = this.config('beforeClose')
			var afterClose = this.config('afterClose')
			var modal = this
			if (isShown[this.id()] && beforeClose.call(modal) !== false) {
				isShown[this.id()] = false
				var el = getElement(this)

				var restoreLastModal = false
				if (stack.length == indexes[this.id()]+1) {
					restoreLastModal = true
				}
				delete stack[indexes[this.id()]]
				trimStackRight()
				if (stack.length && restoreLastModal) {
					var lastModal = stack[stack.length - 1]
					document.body.addEventListener('focus', focusListeners[lastModal.id()], true)
					document.addEventListener('keydown', keydownListeners[lastModal.id()], true)
					getElement(lastModal).removeAttribute('aria-hidden')
				}

				el.removeEventListener(transitionEvent, afterOpenCallback)

				document.body.removeEventListener('focus', focusListeners[this.id()], true)
				document.removeEventListener('keydown', keydownListeners[this.id()], true)
				// Hide modal
				el.setAttribute('hidden', true)
				el.setAttribute('aria-hidden', true)
				if (!stack.length) document.getElementById('main').removeAttribute('aria-hidden')
				// Reset focus to previously focused element
				previouslyFocusedElements[this.id()].focus()

				afterCloseCallback = function() {
					el.removeEventListener(transitionEvent, afterCloseCallback)
					if (!stack.length) bodyLocker.unlock()
					afterClose.call(modal)
				}
				if (hasTransition(el)) {
					el.addEventListener(transitionEvent, afterCloseCallback)
				} else {
					afterCloseCallback()
				}
				return true
			} else {
				return false
			}
		}
	}
})()
