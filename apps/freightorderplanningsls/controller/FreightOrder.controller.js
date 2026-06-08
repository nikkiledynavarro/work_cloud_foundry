sap.ui.define([
	"com/erpis/shiperp/sls/freightordersls/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/sls/freightordersls/model/formatter",
	"com/erpis/shiperp/sls/freightordersls/common/Utils",
	"com/erpis/shiperp/sls/freightordersls/common/DynamicFilter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/sls/freightordersls/common/HttpHelper",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, Filter, FilterOperator, formatter, Utils, DynamicFilter, MessageBox, HttpHelper, MessageToast) {
	"use strict";
	var oSrvPath = {
		carrierSrv: "xSERPTMxFODDCarrierServiceSet"
	};
	return BaseController.extend("com.erpis.shiperp.sls.freightordersls.controller.FreightOrder", {
		formatter: formatter,

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrder
		 */
		onInit: function () {
			this.filterCallback = true; //for init change dynamic filter
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				screenId: "fo",
				ExecutionStatusKey: "All",
				FreightUnit: "",
				FreightOrderForm: {
					FreightOrder: "",
					ObjectTypes: []
				},
				FreightOrderChanged: [],
				SelectedFreightOrderNumber: ""
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("freightOrder").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			this.oVModel = this.getModel("local");
			this.onInitCreatedOn(); //set default data for created on
			// var oDynamicFilterComp = this._getControlById("foDynamicFilter");
			// oDynamicFilterComp.fireSearch();
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.oVModel.setProperty("/FreightOrderChanged", []);
		},

		onNavBackToFreightUnitScreen: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightUnit", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},

		onFreightOrderPressed: function (oEvent) {
			var oItem = oEvent.getSource();
			this.showBusy();
			this.getRouter().navTo("freightOrderDetail", {
				FreightOrderNumber: oItem.getBindingContext().getProperty("FreightOrderNumber"),
				Station: this.sStation,
				Profile: this.sProfile
			}, false);
		},
		onFreightOrderItemNavPressed: function (oEvent) {
			var oCurrentRow = this._getCurrentRow(oEvent);
			this.setFreightOrderItemData(oCurrentRow);
			this.showBusy();
			this.getRouter().navTo("freightOrderDetailItem", {
				FreightOrderNumber: oCurrentRow.FreightOrderNumber,
				Station: this.sStation,
				Profile: this.sProfile
			}, false);
		},

		onRateQuoteActionPressed: function () {
			if (this._checkValidBeforeNavScreen()) {
				this.showBusy();
				this.getRouter().navTo("rateQuote", {
					Station: this.sStation,
					Profile: this.sProfile
				});
			}
		},

		onRequestRoutingActionPressed: function () {
			if (this._checkValidBeforeNavScreen()) {
				this.showBusy();
				this.getRouter().navTo("requestRouting", {
					Station: this.sStation,
					Profile: this.sProfile
				});
			}
		},

		onRequestForPickUpActionPressed: function () {
			if (this._checkValidBeforeNavScreen()) {
				this.showBusy();
				this.getRouter().navTo("requestForPickup", {
					Station: this.sStation,
					Profile: this.sProfile
				});
			}

		},
		onCarrierChange: function (oEvent) {
			var oCurrentRow = this._getCurrentRow(oEvent);
			var sSelectedCarrier = oEvent.getSource().getSelectedKey();
			//update carrier changed
			this.updateFreightOrderChanged(oCurrentRow, "Carrier", sSelectedCarrier);

		},
		/** Handle Carrier service value help*/
		_getFinalCarrier: function (oCurrentRow) {
			//return current Carrier if not change
			var aFreightOrderChanged = this.oVModel.getProperty("/FreightOrderChanged");
			if (Utils.isEmptyArray(aFreightOrderChanged)) {
				return oCurrentRow.Carrier;
			}
			//get changed Carrier
			var oExistFreightOrderRow = Utils._getExistingArray(aFreightOrderChanged, "FreightOrderNumber", oCurrentRow.FreightOrderNumber);
			//insert freight order data
			if (Utils.isEmpty(oExistFreightOrderRow)) {
				return oCurrentRow.Carrier;
			}
			return oExistFreightOrderRow.Carrier;
		},
		onSelectCarrierService: function (oEvent) {
			this.showBusy();
			var oThis = this;
			this.oCurrCarrierSrvControl = oEvent.getSource();
			//filter carrier
			var oCurrentRow = this._getCurrentRow(oEvent);
			var sCarrierId = this._getFinalCarrier(oCurrentRow);
			var oCarrierSrvDef = this.getCarrierServiceData(sCarrierId);
			oCarrierSrvDef.done(function (aCarrierServices) {
				oThis.hideBusy();
				oThis.oVModel.setProperty("/CarrierServices", aCarrierServices);
				oThis._CarrierSrvDlg = Utils.getFragment(null, "freightorder.CarrierServiceValueHelpDlg", oThis);
				oThis._CarrierSrvDlg.open();
			}.bind(this));
		},
		onCarrierSrvValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("CarrierServiceId", FilterOperator.Contains, sValue);

			oEvent.getSource().getBinding("items").filter([oFilter]);
		},
		onCarrierSrvValueHelpClose: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			oEvent.getSource().getBinding("items").filter([]);
			if (!oSelectedItem) {
				return;
			}
			if (this.oCurrCarrierSrvControl) {
				this.oCurrCarrierSrvControl.setValue(oSelectedItem.getTitle());
			}
		},
		/** Handle Carrier service value help*/
		onCarrierServiceChange: function (oEvent) {
			var oCurrentRow = this._getCurrentRow(oEvent);
			var sSelectedCarrierSrv = oEvent.getSource().getSelectedKey();
			this.updateFreightOrderChanged(oCurrentRow, "CarrierService", sSelectedCarrierSrv);
		},
		onEquipmentChange: function (oEvent) {
			var oCurrentRow = this._getCurrentRow(oEvent);
			var sSelectedEquipment = oEvent.getSource().getSelectedKey();
			this.updateFreightOrderChanged(oCurrentRow, "EquipmentType", sSelectedEquipment);
		},
		onDangerousChange: function (oEvent) {
			var oCurrentRow = this._getCurrentRow(oEvent);
			var bSelectedDG = oEvent.getSource().getSelected();
			this.updateFreightOrderChanged(oCurrentRow, "DangerousGoods", bSelectedDG);
		},
		updateFreightOrderChanged: function (oCurrentRow, fieldToUpdate, valueToUpdate) {
			var aFreightOrderChanged = this.oVModel.getProperty("/FreightOrderChanged");
			if (Utils.isEmptyArray(aFreightOrderChanged)) {
				//if list empty update value and push row to list
				oCurrentRow[fieldToUpdate] = valueToUpdate;
				aFreightOrderChanged.push(oCurrentRow);
			} else {
				//check row exists
				var oExistFreightOrderRow = Utils._getExistingArray(aFreightOrderChanged, "FreightOrderNumber", oCurrentRow.FreightOrderNumber);
				//insert freight order data
				if (Utils.isEmpty(oExistFreightOrderRow)) {
					oCurrentRow[fieldToUpdate] = valueToUpdate;
					aFreightOrderChanged.push(oCurrentRow);
				}
				//update freight order data
				if (!Utils.isEmpty(oExistFreightOrderRow)) {
					oExistFreightOrderRow[fieldToUpdate] = valueToUpdate;
				}

			}
		},
		/**
		 * Set selected freight order number to reuse in furture
		 * */
		onFreightOrderSelectionChange: function (oEvent) {
			var sSelectedFreightOrderNumber = "";
			var aSelectedContexts = oEvent.getSource().getSelectedContexts();
			if (!Utils.isEmptyArray(aSelectedContexts)) {
				var oCurrentSelectedRow = aSelectedContexts[0].getObject();
				sSelectedFreightOrderNumber = oCurrentSelectedRow.FreightOrderNumber;
			}
			this.oVModel.setProperty("/SelectedFreightOrderNumber", sSelectedFreightOrderNumber);

		},
		/* packing area*/
		onFreightOrderPackButtonPressed: function (oEvent) {

			this._oFreightOrderPackingMADialog = Utils.getFragment(null, "freightorder.FreightOrderPackingMADialog", this);
			this._oFreightOrderPackingMADialog.open();
		},

		onCloseFreightOrderPackingMAPressed: function (oEvent) {
			if (this._oFreightOrderPackingMADialog) {
				this._oFreightOrderPackingMADialog.close();
			}
		},

		onCloseFreightOrderPackingHUPressed: function (oEvent) {
			if (this._oFreightOrderFormDialog) {
				this._oFreightOrderFormDialog.close();
			}
		},

		onFreightOrderCloseButtonPressed: function (oEvent) {
			var aFreightOrderChanged = this.oVModel.getProperty("/FreightOrderChanged");
			if (Utils.isEmptyArray(aFreightOrderChanged) === false) {
				var sConfirmTitle = this.oBundle.getText("foItemCloseConfirmTitle");
				var sConfirmMsg = this.oBundle.getText("foItemCloseConfirmMsg");
				MessageBox.confirm(sConfirmMsg, {
					title: sConfirmTitle,
					actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.YES) {
							var oPayload = {
								ScreenID: "FO",
								To_FreightOrder: aFreightOrderChanged,
								To_FreightUnit: aFreightOrderChanged
							};

							this.getModel().create("/xSERPTMxFUFOCarrierDeterminationSet", oPayload, {
								success: function (oData) {
									MessageToast.show("Success");
									this.hideBusy();
								}.bind(this),
								error: function (oError) {
									MessageToast.show(oError);
									this.hideBusy();
								}.bind(this)
							});
						}
						if (oAction === MessageBox.Action.NO) {
							this.onNavBackToFreightUnitScreen();
						}
					}.bind(this)
				});
			} else {
				this.onNavBackToFreightUnitScreen();
			}
		},

		/** Form dialog*/
		onFormPressed: function (oEvent) {
			var oRow = this._getCurrentRow(oEvent);
			this.oVModel.setProperty("/FreightOrderForm/FreightOrderNumber", oRow.FreightOrderNumber);
			var sampleObj = [{
				ObjectType: "BOL"
			}, {
				ObjectType: "SLI"
			}];
			this.oVModel.setProperty("/FreightOrderForm/ObjectTypes", sampleObj);
			this._oFreightOrderFormDialog = Utils.getFragment(null, "freightorder.FreightOrderFormDialog", this);
			this._oFreightOrderFormDialog.open();
		},

		onFormPrintPreviewPressed: function (oEvent) {

		},

		onCloseoFreightOrderFormDialog: function () {
			if (this._oFreightOrderFormDialog) {
				this._oFreightOrderFormDialog.close();
			}
		},
		getCarrierServiceData: function (carrierId) {
			var aCarrierServices = [];
			var oCarrierSrvDef = $.Deferred();
			var sRequestQuery = this.getMainSrv() + oSrvPath.carrierSrv;
			if (!Utils.isEmpty(carrierId)) {
				sRequestQuery = this.getMainSrv() + oSrvPath.carrierSrv + "?$filter=Carrier eq '" + carrierId + "'";
			}
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					aCarrierServices = oData.d.results;
					oCarrierSrvDef.resolve(aCarrierServices);
				}
			}.bind(this);
			var fnError = function (oData) {

				oCarrierSrvDef.reject();

			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
			return oCarrierSrvDef.promise();

		},
		onUpdatedFreightOrderList: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var aFreightItems = oSmartTable.getTable().getItems();
			//Updated current Carrier Service
			if (!Utils.isEmptyArray(aFreightItems)) {
				//loop throught each row
				var aCarrierServices = [];
				for (var i = 0; i < aFreightItems.length; i++) {
					var oCurrentItem = aFreightItems[i].getBindingContext().getObject();
					if (!Utils.isEmpty(oCurrentItem.CarrierService)) {
						var oCarrService = {
							CarrierServiceId: oCurrentItem.CarrierService,
							CarrierServiceText: oCurrentItem.CarrierService
						};
						var oExistFreightOrderRow = Utils._getExistingArray(aCarrierServices, "CarrierServiceId", oCurrentItem.CarrierService);
						//insert Carrier ServiceId
						if (Utils.isEmpty(oExistFreightOrderRow)) {
							aCarrierServices.push(oCarrService);
						}

					}
				}
				this.oVModel.setProperty("/CarrierServices", aCarrierServices);
			}

		},
		_getSmartTable: function () {
			if (!this._oFreightOrderSmartTable) {
				this._oFreightOrderSmartTable = this.getView().byId("freightOrderTable");
			}
			return this._oFreightOrderSmartTable;
		},
		_getCurrentRow: function (oEvent) {
			var oCurrentRow = oEvent.getSource();
			return oCurrentRow.getBindingContext().getObject();
		},
		_checkValidBeforeNavScreen: function () {
			var sSelectedFreightOrder = this.oVModel.getProperty("/SelectedFreightOrderNumber");
			if (Utils.isEmpty(sSelectedFreightOrder)) {
				var sErrorMsg = this.oBundle.getText("freightOrderNoSelectError");
				MessageBox.error(sErrorMsg);
				return false;
			}
			return true;
		},
		/**End Form dialog*/
		/**
		 * Handle dynamic filter before bind table
		 * lastUpdatedBy: Tim
		 * lastUpdatedDate: 2021/06/09
		 * */
		onBeforeTableRebind: function (oEvent) {
			var oDynamicFilterComp = this._getControlById("foDynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilterComp, true, this);

			// Read the count at this stage because all filters from filterbar are now available
			this._readTheCountsForEachExecutionStatus(aDynamicFilters.slice(0)[0]);

			// Adjust the Filter object to include Execution status
			var oExecutionStatusFilter;
			var sExecutionStatusKey = this.getModel("local").getProperty("/ExecutionStatusKey");
			if (sExecutionStatusKey !== "All") {
				oExecutionStatusFilter = DynamicFilter.buildExcutionStatusFilter(sExecutionStatusKey);
			}

			if (aDynamicFilters.length === 0) {
				if (oExecutionStatusFilter && oExecutionStatusFilter !== null) {
					aDynamicFilters.push(oExecutionStatusFilter);
					oEvent.getParameter("bindingParams").filters = aDynamicFilters; //set filter for table
				}
			} else {
				if (oExecutionStatusFilter && oExecutionStatusFilter !== null) {
					var oAllFilter = new Filter([aDynamicFilters[0], oExecutionStatusFilter], true);
					oEvent.getParameter("bindingParams").filters = oAllFilter;
				} else {
					oEvent.getParameter("bindingParams").filters = aDynamicFilters; //set filter for table
				}
			}
		},

		onShowOverlay: function (oEvent) {
			oEvent.getParameter("overlay").show = false;
		},

		onQuickFilter: function () {
			this.byId("foDynamicFilter").fireSearch();
		},
		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */

		/**
		 * This method will prepare Planning Status Filter
		 * This method is not designed to be re-used
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to be included in Planning Status Filter
		 */
		_prepareExecutionStatusFilters: function (oFilter) {
			var oNotStartedFilter = DynamicFilter.buildExcutionStatusFilter("NotStarted");
			var oLoaddedFilter = DynamicFilter.buildExcutionStatusFilter("Loadded");
			var oInExecutionFilter = DynamicFilter.buildExcutionStatusFilter("InExecution");
			this._mExecutionStatusFilters = {
				All: oFilter,
				NotStarted: (oFilter) ? new Filter({
					filters: [oFilter, oNotStartedFilter],
					and: true
				}) : oNotStartedFilter,
				Loadded: (oFilter) ? new Filter({
					filters: [oFilter, oLoaddedFilter],
					and: true
				}) : oLoaddedFilter,
				InExecution: (oFilter) ? new Filter({
					filters: [oFilter, oInExecutionFilter],
					and: true
				}) : oInExecutionFilter
			};
			return this._mExecutionStatusFilters;
		},

		/**
		 * This method will read data from "/xSERPTMxFreightOrderSet/$count" with aFilters for each type of ExecutionStatus
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to read counters
		 */
		_readTheCountsForEachExecutionStatus: function (oAllFilter) {
			var oViewModel = this.getModel("local"),
				aExecutionStatusFilters = this._prepareExecutionStatusFilters(oAllFilter);
			jQuery.each(aExecutionStatusFilters, function (sKey, oFilter) {
				this.getModel().read("/xSERPTMxFreightOrderSet/$count", {
					filters: (oFilter) ? [oFilter] : [],
					groupId: "xSERPTMxFreightOrderSet" + sKey,
					success: function (oData) {
						var sPath = "/" + sKey;
						oViewModel.setProperty(sPath, oData);
					},
					error: function (oError) {
						jQuery.sap.log.info("Odata Error occured: " + oError.toString());
					}
				});
			}.bind(this));
		},
		onAssignedFiltersChanged: function (oEvent) {
				//handle show/hide filter groups
				if (this.filterCallback === true) {
					this.onHandleSmartFilterBarVisible(oEvent);
				}
				var oStatusText = sap.ui.getCore().byId(this.getView().getId() + "--statusText");
				var oFilterBar = sap.ui.getCore().byId(this.getView().getId() + "--smartFilterBarFreightOrder");
				if (oStatusText && oFilterBar) {
					var sText = oFilterBar.retrieveFiltersWithValuesAsText();
					oStatusText.setText(sText);
				}
			} //end
			// onBeforeVariantFetched: function (oEvent) {
			// 	var oFilterData = oEvent.getSource().getFilterData();
			// 	// Manually Update value for Delivery filter
			// 	var aDelivery = [];
			// 	var sDelivery = this.byId("txtDelivery").getValue();
			// 	aDelivery.push({
			// 		key: "Delivery",
			// 		text: sDelivery
			// 	});
			// 	try {
			// 		oFilterData.Delivery = {};
			// 		oFilterData.Delivery.value = sDelivery;
			// 		oFilterData.Delivery.ranges = [];
			// 		oFilterData.Delivery.items = aDelivery;
			// 	} catch (exc) {
			// 		jQuery.sap.log.info("onBeforeVariantFetched has error while adding custom filter");
			// 	}
			// 	// Manually Update value for TrackingNo filter
			// 	var aTrackingNo = [];
			// 	var sTrackingNo = this.byId("txtTrackingNo").getValue();
			// 	aTrackingNo.push({
			// 		key: "TrackingNo",
			// 		text: sTrackingNo
			// 	});
			// 	try {
			// 		oFilterData.TrackingNo = {};
			// 		oFilterData.TrackingNo.value = sTrackingNo;
			// 		oFilterData.TrackingNo.ranges = [];
			// 		oFilterData.TrackingNo.items = aTrackingNo;
			// 	} catch (exc) {
			// 		jQuery.sap.log.info("onBeforeVariantFetched has error while adding custom filter");
			// 	}
			// 	oEvent.getSource().setFilterData(oFilterData, true);
			// },
			/**
			 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
			 * (NOT before the first rendering! onInit() is used for that one!).
			 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrder
			 */
			//	onBeforeRendering: function() {
			//
			//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrder
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrder
		 */
		//	onExit: function() {
		//
		//	}

	});

});