/*global location*/
jQuery.sap.require("com.erpis.shiperp.hr7.ltlplanning.common.jquery_hotkeys");
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/ltlplanning/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/ltlplanning/model/formatter",
	"com/erpis/shiperp/hr7/ltlplanning/common/Utils",
	"com/erpis/shiperp/hr7/ltlplanning/common/DynamicFilter",
	"com/erpis/shiperp/hr7/ltlplanning/common/AttachmentUtils",
], function (library, BaseController, JSONModel, MessageToast, Fragment, Filter, FilterOperator, MessageBox, formatter,
	Utils, DynamicFilter, AttachmentUtils) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.ltlplanniFng.controller.Main", {
		oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.hr7.ltlplanning.controller.Main"),
		oBundle: null,
		formatter: formatter,

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			// Local dataModel for view
			this.setModel(new JSONModel({
				countAD: 0,
				countOD: 0,
				countWS: 0,
				countTN: 0
			}), "dataModel");
			// Local Model for view
			this.setModel(new JSONModel({}), "local");

			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");

			//set default data for created on
			this.onInitCreatedOn();

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 **/
		_onObjectMatched: function (oEvent) {
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.ShipStation;
			this.sProfile = oEventArgs.Profile;
			this.hideBusy();
		},

		onAssignedFiltersChanged: function (oEvent) {
			//handle show/hide filter groups
			if (this.filterCallback === true) {
				// this.onHandleSmartFilterBarVisible(oEvent);
			}
			var oStatusText = this.byId(this.getView().getId() + "--statusText");
			var oFilterBar = this.byId(this.getView().getId() + "--smartFilterBar");
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		/**
		 * Handle icontabbar filter 
		 **/

		onQuickFilter: function (oEvent) {
			var sType = oEvent.getParameter("key");
			var aFilter;
			var oDynamicFilter = this._getControlById("DynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilter, true, this);
			// Add data filter from initial screen
			var aSmartFilter = aDynamicFilters.slice(0)[0];
			aSmartFilter.aFilters.push(new Filter("profile", FilterOperator.EQ, this.sProfile));
			aSmartFilter.aFilters.push(new Filter("shipStation", FilterOperator.EQ, this.sStation));
			aSmartFilter.aFilters.push(new Filter("level", FilterOperator.EQ, "Delivery Level"));
			aSmartFilter.aFilters.push(new Filter("type", FilterOperator.EQ, sType));
			// Read the count at this stage because all filters from filterbar are now available
			this._readTheFilter(aSmartFilter, sType);
		},

		/**
		 * Handle dynamic filter before bind table
		 **/
		onBeforeTableRebind: function (oEvent) {
			var oDynamicFilter = this._getControlById("DynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilter, true, this);
			// Add data filter from initial screen
			var aSmartFilter = aDynamicFilters.slice(0)[0];
			aSmartFilter.aFilters.push(new Filter("profile", FilterOperator.EQ, this.sProfile));
			aSmartFilter.aFilters.push(new Filter("shipStation", FilterOperator.EQ, this.sStation));
			aSmartFilter.aFilters.push(new Filter("level", FilterOperator.EQ, "Delivery Level"));
			aSmartFilter.aFilters.push(new Filter("type", FilterOperator.EQ, "AD"));
			// Read the count at this stage because all filters from filterbar are now available
			this._readTheFilter(aSmartFilter, "AD");
		},

		/**
		 * This method will read data from "/DocumentListSet" with aFilters for each type of search for
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter}
		 **/
		_readTheFilter: function (Filter, sType) {
			this.byId("planningTable").setBusy(true);
			this.getModel().read("/DocumentListSet", {
				filters: [Filter],
				urlParameters: {
					select: "Tknum,Vbeln,Trailerdocnum,Carrier,Service,Pronumber,Lfdat,Gewei,Btgew,Shiptoname"
				},
				success: function (oData) {
					if (oData.results) {
						var aDataList = [];
						var oCount = {
							countAD: 0,
							countOD: 0,
							countWS: 0,
							countTN: 0
						};
						oData.results.forEach(function (item) {
							// update the variables
							oCount.countAD++;
							if (item.Tknum === "") oCount.countOD++;
							if (item.Tknum !== "") oCount.countWS++;
							if (item.Trailerdocnum === "") oCount.countTN++;

							// Add on aDataList base in Type
							switch (sType) {
							case "AD": // All Deliveries
								aDataList.push(item);
								break;
							case "OD": // Open Deliveries
								if (item.Tknum === "") aDataList.push(item);
								break;
							case "WS": // With Deliveries
								if (item.Tknum !== "") aDataList.push(item);
								break;
							case "TN": // Transportation Number
								if (item.Trailerdocnum === "") aDataList.push(item);
								break;
							}
						});
						// set data smart table
						this.getModel("dataModel").setProperty("/deliveries", aDataList);
						// Set count
						this.getModel("dataModel").setProperty("/AllDeliveries", oCount.countAD);
						this.getModel("dataModel").setProperty("/OpenDeliveries", oCount.countOD);
						this.getModel("dataModel").setProperty("/WithShipment", oCount.countWS);
						this.getModel("dataModel").setProperty("/TransportationNumber", oCount.countTN);
					}

					this.byId("planningTable").setBusy(false);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.byId("planningTable").setBusy(false);
					this.hideBusy();
				}.bind(this)
			});
		},

		ChangeDateRangeSelection: function (oEvent) {
			var sFrom = formatter.formatDate(oEvent.getParameter("from"));
			var sTo = formatter.formatDate(oEvent.getParameter("to"));
			var oBinding = this.byId("idMulDocNo").getBinding("items");
			if (oBinding) {
				oBinding.filter(new Filter("Cretst",
					FilterOperator.BT, sFrom, sTo));
			}
		},

		onSelectionChange: function (oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedItem = oTable.getSelectedItem().getBindingContext("dataModel").getObject();
			if (aSelectedItem) {
				var aDocList = this.getModel("dataModel").getProperty("/deliveries");
				aDocList.forEach(function (obj) {
					if (aSelectedItem.Vbeln === obj.Vbeln) {
						obj.selected = true;
					} else {
						obj.selected = false;
					}
				});
				this.getModel("dataModel").setProperty("/deliveries", aDocList);
			}
		},

		onSelectionChangeBolDetail: function (oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedItem = oTable.getSelectedItem().getBindingContext("local").getObject();
			if (aSelectedItem) {
				var aBoLDetails = this.getModel("local").getProperty("/BolDetails");
				aBoLDetails.forEach(function (obj) {
					if (aSelectedItem.Breit === obj.Breit && aSelectedItem.NetWeight === obj.NetWeight) {
						obj.selected = true;
					}
				});
				this.getModel("local").setProperty("/BolDetails", aBoLDetails);
			}
		},

		//------------ Fragment Plan or Consolidate ------------ 
		onPlan: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			//open dialog
			this._oPlanOrShipment = Utils.getFragment(null, "Plan.PlanShipment", this);
			this._oPlanOrShipment.open();
		},

		//------------ Fragment New Shipment ------------ 
		onPlanNewShipment: function (oEvent) {
			//close Plan dialog
			if (this._oPlanOrShipment) {
				this._oPlanOrShipment.close();
			}
			this.showBusy();
			this.getModel().read("/LTLPlanQuerySet", {
				urlParameters: {
					"$expand": "doclistview,shipdoc,bol_details,Return,rates"
				},
				filters: [
					new Filter("Profile", "EQ", this.sProfile),
					new Filter("ShipStation", "EQ", this.sStation)
				],
				success: function (oData) {
					if (oData.results.length > 0) {
						this.getModel("local").setProperty("/PlanData", oData.results[0].Plan_Data);
						this.getModel("local").setProperty("/Shipment", oData.results[0]);
						this.getModel("local").setProperty("/Bol", oData.results[0].BOL_Header);
					}
					//open dialog
					this._oPlanNewShipment = Utils.getFragment(null, "Plan.PlanNewShipment", this);
					this._oPlanNewShipment.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		//---------------- Fragment Plan To Existing Shipment ------------
		onPlantoExistingShipment: function (oEvent) {
			//close Plan dialog
			if (this._oPlanOrShipment) {
				this._oPlanOrShipment.close();
			}
			this.showBusy();
			var oRequestPayload = this.generatePlantoExistingShipmentPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {

					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					} else {
						this.getModel("local").setProperty("/ExistingShipment", oData.shipdoc.results);
						//open dialog
						this._oConsToExistShipment = Utils.getFragment(null, "Plan.ConsolidateToExistingShipment", this);
						this.byId("idConsSelectedShip").removeSelections();
						this._oConsToExistShipment.open();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},

		generatePlantoExistingShipmentPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "Plan",
				PlanAction: "E",
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: []
			};
			return oPayload;
		},

		// Consolidate to selected shipment
		onProcessConsolidation: function () {
			this.showBusy();
			var oRequestPayload = this.generateConsolidationPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					this._oConsToExistShipment.close();
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateConsolidationPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "Plan",
				PlanAction: "C",
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: this.getModel("local").getProperty("/ConsolidateSelectedShip"),
				bol_details: []
			};
			return oPayload;
		},

		// Select consolidate
		onSelectionConsolidate: function (oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedCons = [];
			if (aSelectedItems.length > 0) {
				aSelectedItems.forEach(function (item) {
					aSelectedCons.push(item.getBindingContext("local").getObject());
				})
				this.getModel("local").setProperty("/ConsolidateSelectedShip", aSelectedCons);
			} else {
				this.getModel("local").setProperty("/ConsolidateSelectedShip", []);
			}
		},

		onChangeCarrierBol: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// filter Carrier
			if (sSelectedKey) {
				//Carrier
				this.byId("idServiceBol").getBinding("items").filter([new sap.ui.model.Filter("Scac", sap.ui.model.FilterOperator.Contains,
					sSelectedKey)]);
				//Cod type
				this.byId("idCODType").getBinding("items").filter([new sap.ui.model.Filter("Carriercode", sap.ui.model.FilterOperator.Contains,
					sSelectedKey)]);
			} else {
				//Carrier
				this.byId("idServiceBol").getBinding("items").filter([]);
				//Cod type
				this.byId("idCODType").getBinding("items").filter([]);
			}
		},

		onChangeCarrier: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// filter Carrier
			if (sSelectedKey) {
				//Carrier
				this.byId("idServicePlan").getBinding("items").filter([new sap.ui.model.Filter("Scac", sap.ui.model.FilterOperator.Contains,
					sSelectedKey)]);
			} else {
				this.byId("idServicePlan").getBinding("items").filter([]);
			}
		},

		onChangeService: function (oEvent) {
			var oSeletedItem = oEvent.getSource().getSelectedItem();
			if (oSeletedItem) {
				var sSelected = oSeletedItem.getBindingContext().getObject().Scac;
				this.byId("idCarrierBol").setSelectedKey(sSelected);
			} else {
				this.byId("idCarrierBol").setSelectedKey("");
			}
		},

		onChangeServicePlan: function (oEvent) {
			var oSeletedItem = oEvent.getSource().getSelectedItem();
			if (oSeletedItem) {
				var sSelected = oSeletedItem.getBindingContext().getObject().Scac;
				this.byId("idCarrierPlan").setSelectedKey(sSelected);
			} else {
				this.byId("idCarrierPlan").setSelectedKey("");
			}
		},

		onChangeCountry: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			this.byId("idState").getBinding("items").filter([new sap.ui.model.Filter("Land1", sap.ui.model.FilterOperator.Contains,
				sSelectedKey)]);
		},

		onCloseConsSelectShipment: function (oEvent) {
			if (this._oConsToExistShipment) {
				this._oConsToExistShipment.close();
			}
		},

		onCancelNewShipment: function (oEvent) {
			if (this._oPlanNewShipment) {
				this._oPlanNewShipment.close();
			}
		},

		onSearchPlanShipment: function (oEvent) {
			var sValue = oEvent.getParameter("query");
			var aFilter = [];

			if (sValue) {
				aFilter.push(new Filter("", "Contains", sValue));
			}

			var oTable = this.getView().byId("idPlanOrShipment");
			var oBinding = oTable.getBinding("items");
			oBinding.filter(aFilter);
		},

		onAcceptNewShipment: function (oEvent) {
			var sValue = this.getModel("local").getProperty("/PlanData");
			var bRequired = this._checkRequiredPlan(sValue.GeneralData, sValue.PaymentData, sValue.AddDataSection);
			if (bRequired) {
				this.showBusy();
				var requestPayload = this.generateCreateNewShipmentPayload();
				this.getModel().create("/LTLPlanQuerySet", requestPayload, {
					success: function (oData) {
						this._oPlanNewShipment.close();
						if (oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		generateCreateNewShipmentPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "Plan",
				PlanAction: "N",
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: []
			};
			return oPayload;
		},

		_checkRequiredPlan: function (GeneralData, PaymentData, AddDataSection) {
			var hasError = false;
			var fieldIds = {
				Carrier: "idCarrierPlan",
				Service: "idServicePlan",
				ShipmentDesc: "idShipmentDescription",
				PalletCount: "idPallets",
				PieceCount: "idPackages",
				Weight: "idWeight",
				BillingOption: "idBillingOption",
				salesOrg: "idSalesOrg",
				distributionChannel: "idDistributionChannel",
				division: "idDivision"
			};

			for (var key in GeneralData) {
				if (GeneralData.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (GeneralData[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}

			for (var key in PaymentData) {
				if (PaymentData.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (PaymentData[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}

			for (var key in AddDataSection) {
				if (AddDataSection.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (AddDataSection[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}

			return !hasError;
		},

		onSubmit: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var aTokens = oMultiInput.getTokens();
			var sNewValue = oMultiInput.getValue();

			if (sNewValue) {
				var oToken = new sap.m.Token({
					key: sNewValue,
					text: sNewValue
				});
				oMultiInput.addToken(oToken);
				oMultiInput.setValue("");
			}
		},

		//------------ Fragment BoL Override Popup ------------ 
		onRateQuote: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generateRateQuotePayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateRateQuotePayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RateQuote",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: [],

			};
			return oPayload;
		},

		onRateShop: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generateRateShopPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					// Rates list
					try {
						this.getModel("local").setProperty("/Rates", oData.rates.carrierRates.results);
					} catch (exc) {
						this.getModel("local").setProperty("/Rates", []);
						this.oLogger.info("No Rates");
					}
					// Rate detail
					try {
						this.getModel("local").setProperty("/RateDetails", oData.rates.ratesdetail.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateDetails", []);
						this.oLogger.info("No Rates");
					}
					// message return
					try {
						this.getModel("local").setProperty("/RateErrors", oData.Return.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateErrors", []);
						this.oLogger.info("No Carrier Rates");
					}

					// Rate ALVRate Analysis
					try {
						this.getModel("local").setProperty("/AnalysisALV", oData.rates.analysisALV.results);
					} catch (exc) {
						this.getModel("local").setProperty("/AnalysisALV", []);
						this.oLogger.info("No Rates");
					}

					// Rate analysis BizRule
					try {
						this.getModel("local").setProperty("/analysisBizRule", oData.rates.analysisBizRule.results);
					} catch (exc) {
						this.getModel("local").setProperty("/analysisBizRule", []);
						this.oLogger.info("No Rates");
					}

					// Rate analysis Condition
					try {
						this.getModel("local").setProperty("/ConditionLists", oData.rates.analysisCondition.results);
					} catch (exc) {
						this.getModel("local").setProperty("/ConditionLists", []);
						this.oLogger.info("No Rates");
					}
					// Rate Pricings
					try {
						this.getModel("local").setProperty("/RatePricings", oData.rates.pricproc.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RatePricings", []);
						this.oLogger.info("No Rates");
					}
					this._oRates = Utils.getFragment(null, "Rates.RatesDialog", this);
					this._oRates.open();

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateRateShopPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RateShop",
				Consolidate: false,
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				Return: [],
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				}
			};
			return oPayload;
		},

		onAcceptRates: function () {
			this.showBusy();
			var oRequestPayload = this.generateAcceptRateShopPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					this._oRates.close();
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateAcceptRateShopPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RateShop",
				Consolidate: false,
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				Return: [],
				rates: {
					carrierRates: (this.getModel("local").getProperty("/Rates")) ? this.getModel("local").getProperty("/Rates") : [],
					ratesdetail: (this.getModel("local").getProperty("/RateDetails")) ? this.getModel("local").getProperty("/RateDetails") : [],
					pricproc: (this.getModel("local").getProperty("/RatePricings")) ? this.getModel("local").getProperty("/RatePricings") : [],
					analysisBizRule: (this.getModel("local").getProperty("/analysisBizRule")) ? this.getModel("local").getProperty(
						"/analysisBizRule") : [],
					analysisCondition: (this.getModel("local").getProperty("/ConditionLists")) ? this.getModel("local").getProperty(
						"/ConditionLists") : [],
					analysisALV: (this.getModel("local").getProperty("/AnalysisALV")) ? this.getModel("local").getProperty("/AnalysisALV") : []
				}
			};
			return oPayload;
		},
		onCancelRates: function () {
			this._oRates.close();
		},
		onShowPricingDetail: function () {
			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRatePricingDialog) {
				this.oRatePricingDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.ltlplanning.fragment.Rates.RatePricingsDialog", this);
				this.getView().addDependent(this.oRatePricingDialog);
			}
			var oObject = this.byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.hr7.ltlplanning.fragment.Rates.RatePricingColumnListItem",
				this);
			var oBindingInfo = {
				path: "local>/RatePricings",
				template: oRatePricingTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.CarrierCode),
					new Filter("Service", "EQ", oObject.ServiceId)
				]
			};
			sap.ui.getCore().byId("tblRatePricingList").bindItems(oBindingInfo);
			this.oRatePricingDialog.open();
		},

		onCloseRatePricingDialog: function () {
			this.oRatePricingDialog.close();
		},

		onShowRateDetail: function () {
			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRateDetailDialog) {
				this.oRateDetailDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.ltlplanning.fragment.Rates.RateDetailsDialog", this);
				this.getView().addDependent(this.oRateDetailDialog);
			}
			var oObject = this.byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.hr7.ltlplanning.fragment.Rates.RateDetailColumnListItem",
				this);
			var oBindingInfo = {
				path: "local>/RateDetails",
				template: oRateDetailTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.CarrierCode),
					new Filter("Service", "EQ", oObject.ServiceId)
				]
			};
			sap.ui.getCore().byId("tblRateDetailList").bindItems(oBindingInfo);
			this.oRateDetailDialog.open();
		},

		onCloseRateDetailDialog: function () {
			this.oRateDetailDialog.close();
		},

		onAnalysisDataFound: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},

		onShowAnalysisDetail: function () {
			var bNumber = this.byId("tableRates").indexOfItem(this.byId("tableRates").getSelectedItem()) + 1;
			var aAnalysisBizRule = this.getModel("local").getProperty("/analysisBizRule");
			var aListBizRule = [];
			aAnalysisBizRule.forEach(function (item) {
				var parts = item.Node.split('-');
				var result = null;
				for (var i = parts.length - 1; i >= 0; i--) {
					if (!isNaN(parts[i])) {
						result = parts[i];
						break;
					}
				}
				if (item.ParentNode === String(bNumber) || String(bNumber) === result) {
					aListBizRule.push(item);
				}
			});

			this.getModel("local").setProperty("/analysisBizRule", aListBizRule);

			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRateAnalysisDialog) {
				this.oRateAnalysisDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.ltlplanning.fragment.Rates.RateAnalysisDialog", this);
				this.getView().addDependent(this.oRateAnalysisDialog);
			}
			this.oRateAnalysisDialog.open();
		},

		generateRateAnalysisPayload: function () {
			var sSeleted = this.byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var aRatesCarr = this.getModel("local").getProperty("/Rates");
			aRatesCarr.forEach(function (item) {
				if (item.Carrier === sSeleted.Carrier) {
					item.Seleted = true;
				}
			});
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RateShop",
				Consolidate: false,
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				Return: [],
				rates: {
					carrierRates: aRatesCarr,
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				}
			};
			return oPayload;
		},

		onChangeRateAnalysisLine: function (oEvent) {
			var oObject = oEvent.getParameter("rowContext").getObject();
			var oTitle = sap.ui.getCore().byId("txtTabDesc");
			oTitle.setText(oObject.Condition);
			if (this.analyRequest) {
				this.analyRequest.abort();
			}
			var aAnalysisALV = [];
			var aALVRate = this.getModel("local").getProperty("/AnalysisALV");
			aALVRate.forEach(function (item) {
				if (item.Node === oObject.Node) {
					aAnalysisALV.push(item);
				}
			})
			this.getModel("local").setProperty("/ALVRateAnalysis", aAnalysisALV)
		},

		onAfterRateAnalysisOpen: function () {
			var aAnalysis = this.getModel("local").getProperty("/analysisBizRule");
			try {
				this.getModel("local").setProperty("/CarrierRateAnalysis", this.treeify(aAnalysis, "Node", "ParentNode"));
			} catch (exc) {
				this.getModel("local").setProperty("/CarrierRateAnalysis", []);
				this.oLogger.info("No Carrier Rate Analysis");
			}
		},

		onCloseRateAnalysisDialog: function () {
			this.oRateAnalysisDialog.close();
		},

		onConditonAnalysisDialog: function () {
			var sSelectedRow = sap.ui.getCore().byId("tableRateAnalysis").getSelectedIndices();
			if (!sSelectedRow || sSelectedRow.length === 0) {
				MessageBox.error(this.oBundle.getText("missingItemToshowsolidation"));
				return;
			}
			var sCondition = sap.ui.getCore().byId("tableRateAnalysis").getRows()[sSelectedRow].getBindingContext("local").getObject();
			var aConditionTables = this.getModel("local").getProperty("/ConditionLists");
			var aConditionList = [];
			aConditionTables.forEach(function (item) {
				if (sCondition.Condition === item.Tabname) {
					aConditionList.push(item);
				}
			});
			this.getModel("local").setProperty("/ConditionTables", aConditionList);
			if (!this.oConditionTablesDialog) {
				this.oConditionTablesDialog = Utils.getFragment(null, "Rates.ConditionTablesDialog", this);
				this.oConditionTablesDialog.open();
			} else {
				this.oConditionTablesDialog.open();
			}
		},

		onconDitionTableClose: function () {
			this.oConditionTablesDialog.close();
		},

		onCloseRP: function () {
			this.oRequestForPickUpDialog.close();
		},

		onRequestForPickUp: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}

			this.showBusy();
			var oRequestPayload = this.generateRequestForPickUpPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					this.aUserUploadFiles = [];
					if (this.byId("FileUpload") !== undefined) {
						this.aUserUploadFiles = [];
						this.byId("FileUpload").removeAllItems();
					}

					if (oData.requestForPickup) {
						if (oData.requestForPickup.requestPickupIn) {
							var oConvertTime = formatter.formatTime(oData.requestForPickup.requestPickupIn);
							this.getModel("local").setProperty("/PickupRequestInfo", oConvertTime);
						}
						if (oData.requestForPickup.routingRequest.results.length > 0) {
							this.getModel("local").setProperty("/PickupRequest", oData.requestForPickup.routingRequest.results);
							this.oRequestForPickUpDialog = Utils.getFragment(null, "RequestPickup.RequestForPickupDetails", this);
							this.oRequestForPickUpDialog.open();
						}
					}

					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateRequestForPickUpPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RequestforPickup",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				requestForPickup: {
					requestPickupIn: {},
					routingRequest: [],
					attachments: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: [],

			};
			return oPayload;
		},

		onSendEmail: function (oEvent) {
			this.showBusy();
			var oRequestPayload = this.generateSendEmailPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					this.oRequestForPickUpDialog.close();
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateSendEmailPayload: function () {
			if (this.aUserUploadFiles.length > 0) {
				var aFiles = AttachmentUtils._buildAttachmentForUpload(this.aUserUploadFiles);
				var aPayloadFiles = AttachmentUtils.uploadAttachment(aFiles);
			}
			var PickupRequestInfo = this.getModel("local").getProperty("/PickupRequestInfo");
			var oConvert = formatter.Convertmilliseconds(PickupRequestInfo);
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "RequestforPickup",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				requestForPickup: {
					requestPickupIn: oConvert,
					routingRequest: this.getModel("local").getProperty("/PickupRequest"),
					attachments: aPayloadFiles
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: [],

			};
			return oPayload;
		},

		onCancel: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generateCancelPayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateCancelPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "Cancel",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: [],

			};
			return oPayload;
		},

		onClose: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generateClosePayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateClosePayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "Close",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: [],
			};
			return oPayload;
		},

		generateBolOverWritePayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "BolOverWrite",
				BolAction: "D",
				BOL_Header: {},
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: []
			};
			return oPayload;
		},

		onBol: function (oEvent) {
			if (this.byId("tableDeliveries").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToClick"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generateBolOverWritePayload();
			this.getModel().create("/LTLPlanQuerySet", oRequestPayload, {
				success: function (oData) {
					var oTotal = {
						totalPieces: 0,
						totalWeight: 0
					};
					//Bol Header
					this.getModel("local").setProperty("/Bol", oData.BOL_Header);
					// Bol Details

					if (oData.bol_details.results.length > 0) {
						this.getModel("local").setProperty("/BolDetails", oData.bol_details.results);
						var sTotalPieces = oData.bol_details.results.reduce(function (sum, item) {
							return sum + Number(item.Subhucnt);
						}, 0);

						var sTotalWeight = oData.bol_details.results.reduce(function (sum, item) {
							return sum + Number(item.Weight);
						}, 0);
						oTotal = {
							totalPieces: sTotalPieces,
							totalWeight: sTotalWeight
						};
					} else {
						this.getModel("local").setProperty("/BolDetails", []);
					}
					this.getModel("local").setProperty("/total", oTotal);
					var oDeferredAll = this._getDropDowns(); // Call the combined function
					oDeferredAll.done(function () {
						this.hideBusy();
					}.bind(this));
					//open dialog
					this._oBoLOverride = Utils.getFragment(null, "BoL.BoLOverride", this);
					this._oBoLOverride.open();
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			})
		},

		_getDropDowns: function () {
			var oDeferredAll = $.Deferred();
			$.when(this._getCODtype(), this._getState(), this._getCountry()).done(function () {
				oDeferredAll.resolve();
			});
			return oDeferredAll;
		},

		onCloselBolOverride: function () {
			this._oBoLOverride.close();
		},

		_getCODtype: function () {
			var oDeferred = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_LTLPLAN_CODTYPE", {
				success: function (oData) {
					othis.getModel("local").setProperty("/CODType", oData.results);
					oDeferred.resolve();
				},
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},
		_getState: function () {
			var oDeferred = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_LTLPLAN_STATE", {
				success: function (oData) {
					othis.getModel("local").setProperty("/State", oData.results);
					oDeferred.resolve();
				},
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_getCountry: function () {
			var oDeferred = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_LTLPLAN_COUNTRY", {
				success: function (oData) {
					othis.getModel("local").setProperty("/Country", oData.results);
					oDeferred.resolve();
				},
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		onSaveInfo: function (oEvent) {
			var sValue = this.getModel("local").getProperty("/Bol");
			var bRequired = this._checkRequiredBol(sValue);
			if (bRequired) {
				this.showBusy();
				var requestPayload = this.generateSaveInfoPayload();
				this.getModel().create("/LTLPlanQuerySet", requestPayload, {
					success: function (oData) {
						if (oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				})
			}
		},

		generateSaveInfoPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "BolOverWrite",
				BolAction: "S",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: this.getModel("local").getProperty("/BolDetails")
			};
			return oPayload;
		},

		onPlanningPrint: function (oEvent) {
			this.showBusy();
			var requestPayload = this.generatePlanningPrintPayload();
			this.getModel().create("/LTLPlanQuerySet", requestPayload, {
				success: function (oData) {
					if (oData.Bol_Print !== "") {
						var convString = this.hexToBase64(oData.Bol_Print);
						var b64Data = convString;
						var blob = this.b64toBlob(b64Data, 'application/pdf');
						var fileURL = URL.createObjectURL(blob);
						window.open(fileURL);
					}
					if (oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			})

		},

		generatePlanningPrintPayload: function () {
			var oPayload = {
				ShipStation: this.sStation,
				Profile: this.sProfile,
				Action: "BolOverWrite",
				BolAction: "P",
				Consolidate: false,
				BOL_Header: this.getModel("local").getProperty("/Bol"),
				Plan_Data: this.getModel("local").getProperty("/PlanData"),
				rates: {
					carrierRates: [],
					ratesdetail: [],
					pricproc: [],
					analysisBizRule: [],
					analysisCondition: [],
					analysisALV: []
				},
				Return: [],
				doclistview: this.getModel("dataModel").getProperty("/deliveries"),
				shipdoc: [],
				bol_details: this.getModel("local").getProperty("/BolDetails")
			};
			return oPayload;
		},

		b64toBlob: function (b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;
			var byteCharacters = atob(b64Data);
			var byteArrays = [];
			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);
				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}
				var byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			var blob = new Blob(byteArrays, {
				type: contentType
			});
			return blob;
		},
		hexToBase64: function (str) {
			var bString = "";
			for (var i = 0; i < str.length; i += 2) {
				bString += String.fromCharCode(parseInt(str.substr(i, 2), 16));
			}
			return btoa(bString);
		},

		_checkRequiredBol: function (Value) {
			var hasError = false;
			var fieldIds = {
				Shipdate: "idShipDate",
				Service: "idServiceBol",
				Carrier: "idCarrierCode",
				Ref1: "idReference1",
				Ref2: "idReference2",
				Codtype: "idCODType",
				Codamount: "idCodAmount",
				Shiptoaddr: "idAddress",
				Shiptocity: "idcity",
				Shiptostate: "idState",
				Shiptozip: "idzip",
				Land1: "idCountry",
				Telf1: "idPhone",
				Remarks: "idRemarks"
			};

			for (var key in Value) {
				if (Value.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (Value[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}

			return !hasError;
		},

		onMessagesFilter: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var oAllFilter = new Filter([
				new Filter("FieldName", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Value", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			sap.ui.getCore().byId("tabHdr").getBinding("items").filter([oAllFilter]);
		},

		onCancelBolOverride: function (oEvent) {
			//open dialog
			this._oCloseShipment = Utils.getFragment(null, "BoL.BoLOverride", this);
			this._oCloseShipment.open();
		},

		onAcceptCloseShipment: function (oEvent) {
			//close dialog
			if (this._oCloseShipment && this._oBoLOverride) {
				this._oCloseShipment.close();
				this._oBoLOverride.close();
			}
		},

		onCancelCloseShipment: function (oEvent) {
			if (this._oCloseShipment) {
				this._oCloseShipment.close();
			}
		},

		onUploadUserFileChange: function (oEvent) {
			var oUploadCollection = oEvent.getSource();
			var aFiles = oEvent.getParameter("files");
			if (aFiles.length > 0) {
				for (var i = 0; i < aFiles.length; i++) {
					AttachmentUtils._handleUploadUserProfilesAttachmentChange(oUploadCollection, aFiles[i], this);
				}
			}
		}
	});
});