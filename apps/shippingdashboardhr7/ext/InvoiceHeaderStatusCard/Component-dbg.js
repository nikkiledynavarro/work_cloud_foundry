(function () {
	"use strict";
	/*global jQuery, sap */

	jQuery.sap.declare("com.erpis.shiperp.shippingdashboardhr7.Component");
	jQuery.sap.require("sap.ovp.cards.custom.Component");

	sap.ovp.cards.custom.Component.extend("com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Component", {
		// use inline declaration instead of component.json to save a round trip
		// Here "Path" denotes a relative path of your fragment/controller from webapp

		metadata: {
			properties: {
				"contentFragment": {
					"type": "string",
					"defaultValue": "com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Content" // Here you have to put the "Path" to the content fragment you want for your custom card
				},
				"headerFragment": {
					"type": "string",
					"defaultValue": "com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Header" // Here you have to put the "Path" to the header fragment you want for your custom card
				}
			},

			version: "@version@",

			library: "sap.ovp",

			includes: [],

			dependencies: {
				libs: [],
				components: []
			},
			config: {},
			customizing: {
				"sap.ui.controllerExtensions": {
					"sap.ovp.cards.generic.Card": {
						controllerName: "com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Chart" // Here you have to put the "Path" to the controller for your custom card
					}
				}
			}
		}
	});
})();

// sap.ui.define(["sap/ovp/cards/generic/Component", "jquery.sap.global"],

// 	function (CardComponent, jQuery) {
// 		"use strict";

// 		return CardComponent.extend("com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Component", {
// 			// use inline declaration instead of component.json to save 1 round trip
// 			metadata: {
// 				properties: {
// 					"contentFragment": {
// 						"type": "string",
// 						"defaultValue": "com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Content"
// 					},
// 					"controllerName": {
// 						"type": "string",
// 						"defaultValue": "com.erpis.shiperp.shippingdashboardhr7.ext.InvoiceHeaderStatusCard.Chart"
// 					},
// 					// "annotationPath": {
// 					// 	"type": "string",
// 					// 	"defaultValue": "com.sap.vocabularies.UI.v1.LineItem"
// 					// },
// 					// "countHeaderFragment": {
// 					// 	"type": "string",
// 					// 	"defaultValue": "sap.ovp.cards.generic.CountHeader"
// 					// },
// 					// "headerExtensionFragment": {
// 					// 	"type": "string",
// 					// 	"defaultValue": "sap.ovp.cards.generic.KPIHeader"
// 					// },
// 					"chartAnnotationPath": {
// 						"type": "string",
// 						"defaultValue": "com.sap.vocabularies.UI.v1.Chart#TrackingNumberByCarrier"
// 					},
// 					"dataPointAnnotationPath": {
// 						"type": "string",
// 						"defaultValue": "com.sap.vocabularies.UI.v1.Chart#TrackingNumberByCarrier"
// 					},
// 					// "headerExtensionFragment": {
// 					// 	"type": "string",
// 					// 	"defaultValue": "sap.ovp.cards.generic.KPIHeader"
// 					// },
// 					// "headerExtensionFragment": {
// 					// 	"type": "string",
// 					// 	"defaultValue": "sap.ovp.cards.generic.KPIHeader"
// 					// },

// 				},

// 				version: "${version}",

// 				library: "sap.ovp",

// 				includes: [],

// 				dependencies: {
// 					components: []
// 				},
// 				config: {}
// 			}
// 		});
// 	}
// );
