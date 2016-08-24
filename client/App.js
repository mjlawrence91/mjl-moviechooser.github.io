class App {
  static get WHOS () {
    return {
      'Alex': 'info',
      'Matt': 'primary',
      'Rob': 'danger'
    }
  }

  static get ENTER_KEYCODE () {
    return 13
  }

  constructor () {
    this._selectContainer = document.querySelector('#selection')
    this._listHtml = document.querySelector('#list').innerHTML
    this._whosHtml = document.querySelector('#whos').innerHTML
    this._whosFiltersHtml = document.querySelector('#whosfilters').innerHTML

    // Needed for mobile doubletap handler
    this._tappedTwice = false

    // Ensures all methods are accessible throughout the class
    this._createBindings()
  }

  init () {
    this._firstRender()
    this._addHandlers()
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

    const titleElement = document.createElement('h1')
    titleElement.classList.add('header__title')
    titleElement.innerHTML = title

    document.querySelector('.header').appendChild(titleElement)
  }

  renderWhos () {
    const renderWhosView = _.template(this._whosHtml)
    const whosSelect = document.querySelector('select')

    let options = whosSelect.innerHTML
    Object.keys(App.WHOS).forEach(who => { options += renderWhosView({who}) })
    whosSelect.innerHTML = options
  }

  renderWhosFilters () {
    const renderWhosFiltersView = _.template(this._whosFiltersHtml)
    const filtersContainer = document.querySelector('.filters')

    Object.keys(App.WHOS).forEach(who => {
      filtersContainer.innerHTML += renderWhosFiltersView({who, colours: App.WHOS})
    })
  }

  fetchMovies () {
    const moviesString = localStorage.getItem('movies')
    return JSON.parse(moviesString) || []
  }

  savetoStore (newMovie) {
    const movieList = this.fetchMovies()
    const isUnique = movieList.filter(movie => movie.name === newMovie.name).length === 0

    if (isUnique) {
      movieList.push(newMovie)

      const moviesString = JSON.stringify(movieList)
      localStorage.setItem('movies', moviesString)
    }
  }

  addMovie (evt) {
    if (evt) evt.preventDefault()

    let movieName = ''
    let who = ''

    if (new FormData().get) {
      const formData = new FormData(evt.target)
      movieName = formData.get('movie')
      who = formData.get('who')
    } else { // Fix for iOS
      movieName = document.querySelector('[name=movie]').value
      who = document.querySelector('[name=who]').value
    }

    if (movieName && who) {
      const newModel = {name: movieName, who}
      this.savetoStore(newModel)

      this.render(this.fetchMovies())
      this._clearFormValues()

      // Re-focus name field for new entry
      document.querySelector('input[name=movie]').focus()
    }
  }

  chooseRandom (evt) {
    if (evt) evt.preventDefault()
    this._showSpinner()

    const movies = this.fetchMovies()
    const filterEl = document.querySelector('.js-filter.active')
    const filteredMovies = (filterEl ? movies.filter(movie => movie.who === filterEl.innerHTML) : movies)

    const rand = Math.floor(Math.random() * filteredMovies.length)
    const {name} = filteredMovies[rand] || {name: 'No movies.'}

    const delayRender = _ => {
      this.render(movies, name)
      this._hideSpinner()
    }

    setTimeout(delayRender, 3000)
  }

  removeMovie (evt) {
    if (evt) evt.preventDefault()

    const movieLink = evt.target.parentNode
    movieLink.removeEventListener('click', this.removeMovie)

    const movieToDelete = movieLink.getAttribute('data-remove')
    this.removeFromStore(movieToDelete)
    this.render(this.fetchMovies())
  }

  removeFromStore (movieToDelete) {
    const movies = this.fetchMovies()
    const moviesWithoutRemoved = movies.filter(movie => movie.name !== movieToDelete)
    const moviesString = JSON.stringify(moviesWithoutRemoved)
    localStorage.setItem('movies', moviesString)
  }

  _createBindings () {
    this.init = this.init.bind(this)
    this.render = this.render.bind(this)
    this.renderTitle = this.renderTitle.bind(this)
    this.renderWhos = this.renderWhos.bind(this)
    this.renderWhosFilters = this.renderWhosFilters.bind(this)
    this.savetoStore = this.savetoStore.bind(this)
    this.addMovie = this.addMovie.bind(this)
    this.removeMovie = this.removeMovie.bind(this)
    this.removeFromStore = this.removeFromStore.bind(this)
    this._firstRender = this._firstRender.bind(this)
    this._addHandlers = this._addHandlers.bind(this)
    this._saveTitleOnBlur = this._saveTitleOnBlur.bind(this)
    this._filterRandom = this._filterRandom.bind(this)
  }

  _firstRender () {
    // Load movies and title, then render
    const movies = this.fetchMovies()
    this.render(movies)

    // Load stored title if one present
    this.renderTitle()

    // Load options and filters for who suggested a movie
    this.renderWhos()
    this.renderWhosFilters()
  }

  _addHandlers () {
    const form = document.querySelector('form')
    const title = document.querySelector('.header__title')
    const filters = document.querySelectorAll('.js-filter')

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

    // Click handler for filters
    Array.from(filters).forEach(filter => filter.addEventListener('click', this._filterRandom))
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
      return evt.target.classList.remove('active')
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
window.addEventListener('load', app.init)