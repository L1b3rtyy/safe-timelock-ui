import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* import specific icons */
// https://fontawesome.com/search
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faTrashCan, faEdit, faSave, faCopy, faArrowUpFromBracket, faCancel, faAngleUp, faAngleDown, faDatabase } from '@fortawesome/free-solid-svg-icons';

library.add([faTrashCan, faEdit, faSave, faCopy, faArrowUpFromBracket, faCancel, faAngleUp, faAngleDown, faGithub, faDatabase]);

createApp(App)
.component('font-awesome-icon', FontAwesomeIcon)
.mount('#app')
