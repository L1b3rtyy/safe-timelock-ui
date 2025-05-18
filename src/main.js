import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* import specific icons */
// https://fontawesome.com/search
import { faTrashCan, faEdit, faSave, faCopy, faArrowUpFromBracket, faCancel } from '@fortawesome/free-solid-svg-icons';

library.add([faTrashCan, faEdit, faSave, faCopy, faArrowUpFromBracket, faCancel]);

createApp(App)
.component('font-awesome-icon', FontAwesomeIcon)
.mount('#app')
