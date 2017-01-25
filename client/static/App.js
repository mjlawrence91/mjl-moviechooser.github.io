'use strict'

class App {
  static get WHOS () {
    return {
      'Alex': {primary: '#9C27B0'},
      'Charl': {primary: '#4CAF50'},
      'Matt': {primary: '#2196F3'},
      'Rob': {primary: '#F44336'}
    }
  }

  static get ENTER_KEYCODE () {
    return 13
  }

  static get POLYFILLS () {
    return {
      underscore: 'https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js',
      webcomponentsjs: 'https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/0.7.23/webcomponents.min.js',
      webcomponentsjsLocal: 'lib/webcomponents.min.js',
      customelements: 'lib/custom-elements.min.js',
      underscoreLocal: 'lib/underscore-min.js'
    }
  }

  constructor () {
    this._selectContainer = document.querySelector('#selection')
    this._listHtml = document.querySelector('#list').innerHTML
    this._whosHtml = document.querySelector('#whos').innerHTML
    this._whosFiltersHtml = document.querySelector('#whosfilters').innerHTML
    this._rippleHandler = new RippleHandler()

    this.customElementsSupported = !!window.customElements
    this.shadowDOMSupported = !!HTMLElement.prototype.attachShadow
    this.htmlImportsSupported = ('import' in document.createElement('link'))

    this._movies = []

    console.info('Custom Elements supported', this.customElementsSupported)
    console.info('Shadow DOM supported', this.shadowDOMSupported)
    console.info('HTML Imports supported', this.htmlImportsSupported)

    // Needed for mobile doubletap handler
    this._tappedTwice = false

    // Ensures all methods are accessible throughout the class
    this._createBindings()

    // Remove preload styles
    this._selectContainer.classList.remove('preload')
  }

  _lazyLoadImport (src) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'import'
      link.href = src
      link.onload = resolve
      link.onerror = reject
      document.head.appendChild(link)
    })
  }

  _lazyLoadScript (src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  init () {
    // Register service worker
    if ('serviceWorker' in navigator) {
      // navigator.serviceWorker.register('./sw.js', {scope: '/'})
    }

    // For mobile browsers...
    // if (!this.customElementsSupported) {
      // Load polyfills and Underscore library [TODO]
      // Promise.all([
        // this._lazyLoadScript(App.POLYFILLS.underscore),App.POLYFILLS.underscore),
        // this._lazyLoadScript(App.POLYFILLS.webcomponentsjs),
        // this._lazyLoadScript(App.POLYFILLS.webcomponentsjsLocal),
        // this._lazyLoadScript(App.POLYFILLS.customelements),
        // this._lazyLoadScript(App.POLYFILLS.underscoreLocal)
      // ]).then(_ => this.render(this._movies))
        // .catch(error => console.error(error))
    // } else {
      Promise.all([
        this._lazyLoadImport('/static/elements/movie-list-item.html'),
        this._lazyLoadImport('/static/elements/movie-list.html')
      ]).then(_ => {
        // this.render(this._movies)
        // Load stored title if one present
        this.renderTitle()

        // Load options and filters for who suggested a movie
        this.renderWhos()
        this.renderWhosFilters()

        // Enables button ripples
        this._rippleHandler.init()

        // Load event handlers
        this._addHandlers()
      })
      .catch(error => console.error('Error loading HTML imports', error))
    // }
  }

  render (movies, selection) {
    const selected = selection || 'Click Choose to select random idea...'
    const renderSelectView = _.template(this._listHtml)
    const html = renderSelectView({selected, movies, colours: App.WHOS})
    this._selectContainer.innerHTML = html

    if (movies.length) {
      const removes = document.querySelectorAll('a.remove')
      const removesArray = Array.from(removes)
      removesArray.forEach(remove => remove.addEventListener('click', this.removeMovie))
    }
  }

  renderTitle () {
    const title = localStorage.getItem('title') || 'Movie Chooser'
    document.querySelector('.header__title').innerText = title
  }

  renderWhos () {
    const whosSelect = document.querySelector('select')
    const fragment = document.createDocumentFragment()

    Object.keys(App.WHOS).forEach(who => {
      const newOption = document.createElement('option')
      newOption.value = who
      newOption.textContent = who
      fragment.appendChild(newOption)
    })

    whosSelect.appendChild(fragment)
  }

  renderWhosFilters () {
    const filtersContainer = document.querySelector('.filter-group')
    const fragment = document.createDocumentFragment()

    Object.keys(App.WHOS).forEach((who) => {
      const newFilter = document.createElement('button')
      newFilter.classList.add('ripple', 'filter-btn', 'btn-sm', 'js-filter')
      newFilter.style.backgroundColor = App.WHOS[who].primary
      newFilter.innerText = who
      newFilter.addEventListener('click', this._filterRandom)
      fragment.appendChild(newFilter)
    })

    filtersContainer.appendChild(fragment)
  }

  savetoStore (newMovie) {
    const isUnique = this._movies.filter(movie => movie.name === newMovie.name).length === 0

    if (isUnique) {
      const request = new MovieRequest('/api/movies')

      request.post(newMovie).then((newModel) => {
        this._movies.push(newModel)

        this.render(this._movies)
        this._clearFormValues()

        // Re-focus name field for new entry
        document.querySelector('input[name=movie]').focus()
      })
    }
  }

  addMovie (evt) {
    if (evt) evt.preventDefault()

    const movieName = document.querySelector('[name=movie]').value
    const who = document.querySelector('[name=who]').value

    if (movieName && who) {
      const newModel = {name: movieName, who}
      this.savetoStore(newModel)
    }
  }

  chooseRandom (evt) {
    if (evt) evt.preventDefault()
    const movieList = document.querySelector('movie-list')

    if (movieList.hasAttribute('loading')) {
      return
    }

    requestAnimationFrame(_ => {
      movieList.showSpinner()

      const delayRender = _ => {
        const activeFilter = document.querySelector('.js-filter.active')
        const filterText = (activeFilter) ? activeFilter.textContent : ''

        movieList.chooseRandom(filterText)
        movieList.hideSpinner()
      }

      setTimeout(delayRender, 3000)
    })
  }

  removeMovie (evt) {
    if (evt) evt.preventDefault()

    const movieLink = evt.target.parentNode
    movieLink.removeEventListener('click', this.removeMovie)

    const movieToDelete = movieLink.getAttribute('data-remove')
    this.removeFromStore(movieToDelete)
  }

  removeFromStore (movieToDelete) {
    const request = new MovieRequest(`/api/movies/${movieToDelete}`)

    request.delete().then(_ => {
      const moviesWithoutRemoved = this._movies
        .filter(movie => movie._id !== movieToDelete)

      this._movies = moviesWithoutRemoved
      this.render(this._movies)
    })
  }

  _createBindings () {
    this.init = this.init.bind(this)
    this.render = this.render.bind(this)
    this.renderTitle = this.renderTitle.bind(this)
    this.renderWhos = this.renderWhos.bind(this)
    this.renderWhosFilters = this.renderWhosFilters.bind(this)
    this.savetoStore = this.savetoStore.bind(this)
    this.addMovie = this.addMovie.bind(this)
    this.chooseRandom = this.chooseRandom.bind(this)
    this.removeMovie = this.removeMovie.bind(this)
    this.removeFromStore = this.removeFromStore.bind(this)
    this._addHandlers = this._addHandlers.bind(this)
    this._saveTitleOnBlur = this._saveTitleOnBlur.bind(this)
    this._filterRandom = this._filterRandom.bind(this)
  }

  _addHandlers () {
    const form = document.querySelector('form')
    const title = document.querySelector('.header__title')

    // Add handler for Choose button
    document.querySelector('#choose').addEventListener('click', this.chooseRandom)

    // Add handler to submit form
    form.addEventListener('submit', this.addMovie)

    // Add handler for editing title
    title.addEventListener('dblclick', evt => {
      // Make title editable and select all text
      evt.target.setAttribute('contenteditable', 'true')
      evt.target.focus()
      this._selectText(evt.target)

      // Add handlers for Enter key to save title
      document.addEventListener('keypress', this._saveTitleOnEnter)

      // Add handler to save title when you click/tap off title
      title.addEventListener('blur', this._saveTitleOnBlur)
    })

    // Add doubletap handler for mobile
    document.addEventListener('touchstart', this._doubleTapHandler)
  }

  _doubleTapHandler (evt) {
    if (!this._tappedTwice) {
      this._tappedTwice = true
      setTimeout(_ => { this._tappedTwice = false }, 300)
      return false
    }

    evt.preventDefault()
    evt.target.dispatchEvent(new MouseEvent('dblclick'))
  }

  _saveTitleOnEnter (evt) {
    if (evt.keyCode === App.ENTER_KEYCODE) {
      evt.preventDefault()

      const focussed = document.querySelector(':focus')

      if (focussed === evt.target) {
        evt.target.blur()
      }
    }
  }

  _saveTitleOnBlur (evt) {
    const newTitle = evt.target.innerText
    const storedTitle = localStorage.getItem('title') || 'Movie Chooser'

    if (newTitle) {
      if (newTitle !== storedTitle) {
        localStorage.setItem('title', newTitle)
      }
    } else {
      evt.target.innerText = storedTitle
    }

    evt.target.removeAttribute('contenteditable')

    // Remove save title handlers
    document.removeEventListener('keypress', this._saveTitleOnEnter)
    document.querySelector('.header__title').removeEventListener('blur', this._saveTitleOnBlur)
  }

  _clearFormValues () {
    document.querySelector('input[name=movie]').value = ''
    document.querySelector('select[name=who]').value = ''
  }

  _selectText (element) {
    let range = null
    if (document.body.createTextRange) {
      range = document.body.createTextRange()
      range.moveToElementText(element)
      range.select()
    } else if (window.getSelection) {
      const selection = window.getSelection()
      range = document.createRange()
      range.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  _filterRandom (evt) {
    if (evt.target.classList.contains('active')) {
      evt.target.classList.remove('active')
      return
    }

    const unselected = Array.from(document.querySelectorAll('.js-filter.active'))
    unselected.forEach(uns => uns.classList.remove('active'))
    evt.target.classList.add('active')
  }

  _showSpinner () {
    document.querySelector('#selection').setAttribute('data-loading', 'true')
  }
  _hideSpinner () {
    document.querySelector('#selection').removeAttribute('data-loading')
  }
}

const app = new App()
window.addEventListener('load', _ => app.init())