import Vue from 'vue'
import Vuex from 'vuex'

import syncImports from './modules/imports/sync'
import syncGekkos from './modules/gekkos/sync'
import syncBundles from './modules/bundles/sync'
import syncNotifications from './modules/notifications/sync'
import syncConfig from './modules/config/sync'

export default function() {
  syncImports();
  syncGekkos();
  syncBundles();
  syncNotifications();
  syncConfig();
}
