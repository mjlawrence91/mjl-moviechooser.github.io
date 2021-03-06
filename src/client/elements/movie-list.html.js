export const elementID = '#movie-list-tmpl'

export const elementHTML = `
  <template id="movie-list-tmpl">
    <style>
      :host {
        display: block;
      }

      h4 {
        color: #444;
        font-weight: normal;
        font-size: 24px;
        margin: 10px 0;
      }

      p {
        color: #444;
        font-size: 13px;
      }

      li.movie {
        font-size: 18px;
        margin: 0 5px;
      }
    </style>

    <h4 class="display">Click Choose to select random idea...</h4>
    <p>Click a movie's name to remove it from the list.</p>
  </template>
`
