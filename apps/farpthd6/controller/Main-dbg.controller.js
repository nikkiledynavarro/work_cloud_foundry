sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/api/env/Format",
	"sap/viz/ui5/format/ChartFormatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(Controller, JSONModel, Format, ChartFormatter, Filter, FilterOperator) {
	"use strict";

	return Controller.extend("com.erpis.shiperp.farpt.hd6.controller.Main", {

		oFilter: sap.ui.model.Filter,

		onInit: function() {
			var dateFrom = new Date();
			dateFrom.setUTCDate(2);
			dateFrom.setUTCMonth(1);
			dateFrom.setUTCFullYear(2017);

			var dateTo = new Date();
			dateTo.setUTCDate(17);
			dateTo.setUTCMonth(1);
			dateTo.setUTCFullYear(2017);

            //var iOriginalBusyDelay;
			var oModel = new JSONModel();
			oModel.setData({
				delimiterDRS1: "to",
				dateValueDRS1: dateFrom,
				secondDateValueDRS1: dateTo,
				dateFormatDRS1: "MM/dd/yyyy",
				busy: true,
				delay: 0
			});
			//iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.getView().setModel(oModel, "mainViewModel");

			this._iEvent = 0;

			//this.customFormatter();
			this.initFilter();

			this.numShipmentByCarrier();
			this.costByBilloption();
			this.costByShiptype();
			this.costByCarrier();

			
			

		},
		
		onRenderComplete :function(){
			var oViewModel = this.getView().getModel("mainViewModel");
			oViewModel.setProperty("/busy", false);
		},

		initFilter: function() {
			this.getFirstAndLastDayOfMonth();
			this.oFilter = new sap.ui.model.Filter({
				path: "Shipdate",
				operator: sap.ui.model.FilterOperator.BT,
				value1: this.firstday, //"2017-01-01T00:00:00",
				value2: this.lastday //"2017-04-01T00:00:00"
			});
		},

		numShipmentByCarrier: function() {
			var oVizFrame = this.getView().byId("oVizFrame");
			oVizFrame.setModel(sap.ui.getCore().getModel());

			this.setDateFilter();

			var oDataSet = new sap.viz.ui5.data.FlattenedDataset({
				dimensions: [{
					name: "Carrier",
					value: "{Carrier}"
				}],
				measures: [{
					name: "No. of Shipments",
					value: "{NumShipments}"
				}],
				
				data: {
					path: "/EtCarrierSet",
					filters: [this.oFilter]
				}

			}); //  .bindData("/EtCarrier",null,null,[]);

			oVizFrame.setDataset(oDataSet);
			oVizFrame.setVizType('bar');

			oVizFrame.setVizProperties({
				plotArea: {
					colorPalette: d3.scale.category20().range(),
					drawingEffect: "glossy"
				},
				valueAxis: {
					label: {
						formatString: "#,##0"
					}
				},
				title: {
					visible: "true",
					text: "Number of Shipments by Carrier"
				}

			});

			var feedValueAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "valueAxis",
				'type': "Measure",
				'values': ["No. of Shipments"]
			});

			var feedCategoryAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "categoryAxis",
				'type': "Dimension",
				'values': ["Carrier"]
			});

			oVizFrame.addFeed(feedValueAxis);
			oVizFrame.addFeed(feedCategoryAxis);
		},

		costByBilloption: function() {
			var oVizFrame2 = this.getView().byId("oVizFrame2");

			oVizFrame2.setModel(sap.ui.getCore().getModel());
			this.setDateFilter();

			var oDataSet2 = new sap.viz.ui5.data.FlattenedDataset({
				dimensions: [{
					name: "Billoption",
					value: "{Billoption}"
				}],
				measures: [{
					name: "Cost",
					value: "{Cost}"
					
				}],
				data: {
					path: "/EtBilloptSet",
					filters: [this.oFilter]
				}

			}); //  .bindData("/EtCarrier",null,null,[]);

			oVizFrame2.setDataset(oDataSet2);
			oVizFrame2.setVizType("pie");

			oVizFrame2.setVizProperties({
				plotArea: {
					dataLabel: {
						visible: true,
						drawingEffect: "glossy"
							//renderer: function(pieDataLabel){pieDataLabel.text = pieDataLabel.ctx.Revenue;}
					}
				},
				tooltip: { formatString: "$#,##0" },
				drawingEffect: "glossy",
				title: {
					visible: "true",
					text: "Cost by Billing Option"
				}

			});

			var feedValueAxis2 = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "size",
				'type': "Measure",
				'values': ["Cost"]
			});

			var feedCategoryAxis2 = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "color",
				'type': "Dimension",
				'values': ["Billoption"]
			});

			oVizFrame2.addFeed(feedValueAxis2);
			oVizFrame2.addFeed(feedCategoryAxis2);
		},

		costByShiptype: function() {
			var oVizFrame = this.getView().byId("oVizFrame3");

			oVizFrame.setModel(sap.ui.getCore().getModel());
			this.setDateFilter();

			var oDataSet = new sap.viz.ui5.data.FlattenedDataset({
				dimensions: [{
					name: "Ship Type",
					value: "{ShiptypeDesc}" //"{path:'Shiptype', formatter:'.shiptypeDesc'}" This formatter is not working.  TODO

				}],
				measures: [{
					name: "Cost",
					value: "{Cost}"
				}],
				data: {
					path: "/EtShiptypeSet",
					filters: [this.oFilter]
				}

			}); //  .bindData("/EtCarrier",null,null,[]);

			oVizFrame.setDataset(oDataSet);
			oVizFrame.setVizType('donut');

			oVizFrame.setVizProperties({
				plotArea: {
					colorPalette: d3.scale.category20().range(),
					drawingEffect: "glossy",
					dataLabel: {
						visible: true,
						drawingEffect: "glossy"
							//renderer: function(pieDataLabel){pieDataLabel.text = pieDataLabel.ctx.Revenue;}
					}
				},
				size: {
					label: {
						formatString: "$#,##0"
					}
				},
				tooltip: { formatString: "$#,##0" },
				title: {
					visible: "true",
					text: "Cost by Ship Type"
				}

			});

			var feedValueAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "size",
				'type': "Measure",
				'values': ["Cost"]
			});

			var feedCategoryAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "color",
				'type': "Dimension",
				'values': ["Ship Type"]
			});

			oVizFrame.addFeed(feedValueAxis);
			oVizFrame.addFeed(feedCategoryAxis);

		},

		costByCarrier: function() {
			var oVizFrame = this.getView().byId("oVizFrame4");

			oVizFrame.setModel(sap.ui.getCore().getModel());
			this.setDateFilter();

			var oDataSet = new sap.viz.ui5.data.FlattenedDataset({
				dimensions: [{
					name: "Carrier",
					value: "{Carrier}"
				}],
				measures: [{
					name: "Cost",
					value: "{Cost}",
					currency: "USD"
				}],
				data: {
					path: "/EtCarrierSet",
					filters: [this.oFilter]
				}

			}); //  .bindData("/EtCarrier",null,null,[]);

			oVizFrame.setDataset(oDataSet);
			oVizFrame.setVizType('bar');

			oVizFrame.setVizProperties({
				plotArea: {
					colorPalette: d3.scale.category20().range(),
					drawingEffect: "glossy",
					formatString: "$#,##0"
				},
				valueAxis: {
					label: {
						formatString: "$#,##0"
					}
				},
				tooltip: { formatString: "$#,##0" },
				title: {
					visible: "true",
					text: "Cost by Carrier"
				}

			});

			var feedValueAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "valueAxis",
				'type': "Measure",
				'values': ["Cost"]
			});

			var feedCategoryAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
				'uid': "categoryAxis",
				'type': "Dimension",
				'values': ["Carrier"]
			});

			oVizFrame.addFeed(feedValueAxis);
			oVizFrame.addFeed(feedCategoryAxis);
		},

		onDateChange: function(oEvent) {
			var oVizFrame = this.getView().byId("oVizFrame");
			var oVizFrame2 = this.getView().byId("oVizFrame2");
			var oVizFrame3 = this.getView().byId("oVizFrame3");
			var oVizFrame4 = this.getView().byId("oVizFrame4");
			var oViewModel = this.getView().getModel("mainViewModel");
			
			oViewModel.setProperty("/busy", true);

			this.setDateFilter();

			oVizFrame.getDataset().bindData("/EtCarrierSet", null, null, this.oFilter);
			oVizFrame2.getDataset().bindData("/EtBilloptSet", null, null, this.oFilter);
			oVizFrame3.getDataset().bindData("/EtShiptypeSet", null, null, this.oFilter);
			oVizFrame4.getDataset().bindData("/EtCarrierSet", null, null, this.oFilter);

			// var sFrom = oEvent.getParameter("from");
			// var sTo = oEvent.getParameter("to");
			// var bValid = oEvent.getParameter("valid");

			// this._iEvent++;

			// var oText = this.byId("TextEvent");
			//oText.setText("Id: " + oEvent.oSource.getId() + "\nFrom: " + sFrom + "\nTo: " + sTo);

			// var oDRS = oEvent.oSource;
			// if (bValid) {
			// 	oDRS.setValueState(sap.ui.core.ValueState.None);
			// } else {
			// 	oDRS.setValueState(sap.ui.core.ValueState.Error);
			// }
		},

		setDateFilter: function() {
			var oDRS1 = this.getView().byId("DRS1");

			this.oFilter = new sap.ui.model.Filter({
				path: "Shipdate",
				operator: sap.ui.model.FilterOperator.BT,
				value1: oDRS1.getDateValue(),
				value2: oDRS1.getSecondDateValue()
				
			});

		},

		getFirstAndLastDayOfMonth: function() {
			var oViewModel = this.getView().getModel("mainViewModel");
			var lastday = new Date(); 
			var firstday = new Date();
			
			firstday.setDate(1);
			
			oViewModel.setProperty("/dateValueDRS1", firstday);   
			oViewModel.setProperty("/secondDateValueDRS1", lastday);   


		},
		
		_bindView: function(sObjectPath) {
			var oViewModel = this.getModel("mainViewModel"),
				oDataModel = this.getModel();
			
			oViewModel.setProperty("/busy", false);
			// this.getView().bindElement({
			// 	path: sObjectPath,
			// 	events: {
			// 		change: this._onBindingChange.bind(this),
			// 		dataRequested: function() {
			// 			oDataModel.metadataLoaded().then(function() {
			// 				// Busy indicator on view should only be set if metadata is loaded,
			// 				// otherwise there may be two busy indications next to each other on the
			// 				// screen. This happens because route matched handler already calls '_bindView'
			// 				// while metadata is loaded.
			// 				oViewModel.setProperty("/busy", true);
			// 			});
			// 		},
			// 		dataReceived: function() {
			// 			oViewModel.setProperty("/busy", false);
			// 		}
			// 	}
			// });
		},
		
		_onBindingChange: function() {
			var oViewModel = this.getModel("mainViewModel");
			oViewModel.setProperty("/busy", false);
		}
		
		// customFormatter: function(){
			
		// 	//var SERP_COST = "formatCurrency";
			
			
		// 	var customerFormatter = {
		// 	    format : function(value, pattern) {
		// 	        // add your codes here to convert number value to formatted string
		// 	        // according to the pattern string
		// 	        if (pattern === "$0.00")
		// 	    		return "$" + value;
		// 	    	else
		// 	    		return value;
		// 	    }
		// 	};
		// 	sap.viz.ui5.api.env.Format.numericFormatter(customerFormatter);
            
             
			
		// },
		
		// myFormatter: function(){
			
			
			
		// }

	});
});