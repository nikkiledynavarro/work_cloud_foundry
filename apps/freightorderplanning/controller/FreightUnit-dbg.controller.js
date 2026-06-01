sap.ui.define([
	"com/erpis/shiperp/freightorderplanning/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/freightorderplanning/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Token",
	"com/erpis/shiperp/freightorderplanning/common/Utils",
	"com/erpis/shiperp/freightorderplanning/common/DynamicFilter"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Token, Utils, DynamicFilter) {
	"use strict";
	// var sFragmentPath = "com.erpis.shiperp.freightorderplanning.fragment.";
	return BaseController.extend("com.erpis.shiperp.freightorderplanning.controller.FreightUnit", {

		formatter: formatter,

		oBundle: null,

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.filterCallback = true; //for init change dynamic filter
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			// Local Model for view
			this._prepareLocalModelForTheView();

			// Initialize Message Model
			var oJSONModel = new JSONModel({

				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			this.getRouter().getRoute("freightUnit").attachPatternMatched(this._onObjectMatched, this);
		},
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			this.onInitCreatedOn(); //set default data for created on
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			// var oDynamicFilterComp = this._getControlById("foDynamicFilter");
			// oDynamicFilterComp.fireSearch();
			var oSmartTable = this._getSmartTable();
			oSmartTable.getTable()._getSelectAllCheckbox().setVisible(false); //Remove check all button
		},
		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			var oFUTab = this._getControlById("itbFreightUnit");
			this.checkSapUi5Version(oFUTab);
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		disableCheckBoxWhenFreightOrderPlanned: function (oSmartTable) {

			var aFreightItems = oSmartTable.getTable().getItems();
			for (var i = 0; i < aFreightItems.length; i++) {
				var oCurrentItem = aFreightItems[i].getBindingContext().getObject();
				aFreightItems[i].getModeControl().setEnabled(true);
				if (oCurrentItem.PlanningStatus === "03") {
					aFreightItems[i].getModeControl().setEnabled(false);
				}
			}

		},
		onUpdateFreightUnitTable: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			//Disable check box when freight order is planned
			this.disableCheckBoxWhenFreightOrderPlanned(oSmartTable);
		},
		_getSmartTable: function () {
			if (!this._oFreightUnitSmartTable) {
				this._oFreightUnitSmartTable = this.getView().byId("freightUnitTable");
			}
			return this._oFreightUnitSmartTable;
		},
		onSort: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Sort");
			}
		},

		onFilter: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Filter");
			}
		},

		onGroup: function () {
			MessageToast.show("Not available as this feature is disabled for this app in the view.xml");
		},

		onColumns: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Columns");
			}
		},

		onAssignedFiltersChanged: function (oEvent) {
			//handle show/hide filter groups
			if (this.filterCallback === true) {
				this.onHandleSmartFilterBarVisible(oEvent);
			}
			var oStatusText = sap.ui.getCore().byId(this.getView().getId() + "--statusText");
			var oFilterBar = sap.ui.getCore().byId(this.getView().getId() + "--smartFilterBar");
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		// onBeforeVariantFetched: function (oEvent) {},
		/**
		 * Handle dynamic filter before bind table
		 * lastUpdatedBy: Tim
		 * lastUpdatedDate: 2021/06/09
		 * */
		onBeforeTableRebind: function (oEvent) {
			var oDynamicFilterComp = this._getControlById("foDynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilterComp, true, this);

			// Read the count at this stage because all filters from filterbar are now available
			this._readTheCountsForEachPlanningStatus(aDynamicFilters.slice(0)[0]);

			// Adjust the Filter object to include planning status
			var oPlanningStatusFilter;
			var sPlaningStatusKey = this.getModel("local").getProperty("/PlanningStatusKey");
			if (sPlaningStatusKey !== "All") {
				oPlanningStatusFilter = DynamicFilter.buildPlaningStatusFilter(sPlaningStatusKey);
			}

			if (aDynamicFilters.length === 0) {
				if (oPlanningStatusFilter && oPlanningStatusFilter !== null) {
					aDynamicFilters.push(oPlanningStatusFilter);
					oEvent.getParameter("bindingParams").filters = aDynamicFilters; //set filter for table
				}
			} else {
				if (oPlanningStatusFilter && oPlanningStatusFilter !== null) {
					var oAllFilter = new Filter([aDynamicFilters[0], oPlanningStatusFilter], true);
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

		// Other events area
		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onFreightUnitPressed: function (oEvent) {
			var oItem = oEvent.getSource();
			this.showBusy();
			this.getRouter().navTo("freightUnitDetail", {
				FreightUnitNumber: oItem.getBindingContext().getProperty("FreightUnitNumber"),
				Station: this.sStation,
				Profile: this.sProfile
			});
		},
		onNavToFreightOrderPressed: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},
		onSelectionChanged: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItems = oTableData.getSelectedItems();
			//uncheck all items planned
			for (var i = 0; i < aSelectedItems.length; i++) {
				var currentItem = aSelectedItems[i].getBindingContext().getObject();
				if (currentItem.OverallStatus === "O") {
					oTableData.setSelectedItem(aSelectedItems[i], false);
				}
			}
		},
		onPlanButtonPressed: function (oEvent) {
			//Call use cae carrier /SERPTM/UCCL_PLN_CARRIER after call plan use case
			var oVModel = this.getModel("local");
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItems = oTableData.getSelectedContexts();
			var aSelectedFreightUnit = [];
			aSelectedItems.forEach(function (item) {
				aSelectedFreightUnit.push(item.getObject());
			});
			oVModel.setProperty("/aSelectedFreightUnit", aSelectedFreightUnit);
			//Checking logic
			var oRequestPayload = this.generateConsolidatePayload(aSelectedFreightUnit);
			this.getModel().create("/FUFOQuerySet", oRequestPayload, {
				success: function (oData) {
					var aOpenFreightOrders = [];
					if (oData.FreightOrders && oData.FreightOrders.results.length > 0) {
						aOpenFreightOrders = oData.FreightOrders.results;
					}
					oVModel.setProperty("/aOpenFreightOrders", aOpenFreightOrders);
					//open dialog
					this._oPlanOrConsolidateDialog = Utils.getFragment(null, "freightunit.PlanOrConsolidateDialog", this);
					// this._oPlanOrConsolidateDialog.setModel(this.getModel("i18n"), "i18n");
					this._oPlanOrConsolidateDialog.open();

				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateConsolidatePayload: function (aSelectedFreightUnit) {
			var oPayload = {
				Action: "DisplayConsolidate",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightUnits: aSelectedFreightUnit,
				FreightOrders: []
			};
			return oPayload;
		},
		//Dialog Plan Or Consolidate Handle
		handlePlanConsolidateSearch: function (oEvent) {
			var sValue = oEvent.getParameter("query");
			var aFilters = [];
			if (sValue && sValue.length > 0) {
				aFilters.push(new Filter("FreightUnitNumber", "Contains", sValue));
			}
			var oPlanConsolidateTbl = this.getView().byId("tblPlanOrConsolidate");
			var oBinding = oPlanConsolidateTbl.getBinding("items");
			oBinding.filter(aFilters);
		},
		onPlanToNewFreightOrderPressed: function (oEvent) {
			var oVModel = this.getModel("local");
			var aSelectedFreightUnit = oVModel.getProperty("/aSelectedFreightUnit");
			if (aSelectedFreightUnit.length === 0) {
				MessageBox.error("Please select at least one Freight Unit");
				return;
			}
			var requestPayload = this.generatePlanToNewFreightOrderPayload(aSelectedFreightUnit);
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here

				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generatePlanToNewFreightOrderPayload: function (aSelectedFreightUnit) {
			var oPayload = {
				Action: "AssignFUtoNewFO",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightUnits: aSelectedFreightUnit,
				FreightOrders: []
			};
			return oPayload;
		},
		onAssignFreightUnitToFOPressed: function (oEvent) {
			var oVModel = this.getModel("local");
			var oOpenFOTable = this.getView().byId("tblPlanOrConsolidate");
			var aSelectedFreightUnit = oVModel.getProperty("/aSelectedFreightUnit");
			var aSelectedOpenFO = [];
			if (oOpenFOTable.getSelectedContexts().length === 0) {
				MessageBox.error("Please select Open Freight Order");
				return;
			}
			var aSelectedFOItems = oOpenFOTable.getSelectedContexts();
			aSelectedFOItems.forEach(function (item) {
				aSelectedOpenFO.push(item.getObject());
			});
			var requestPayload = this.generateAssignFreightUnitToFOPayload(aSelectedFreightUnit, aSelectedOpenFO);
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here

				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateAssignFreightUnitToFOPayload: function (aSelectedFreightUnit, aSelectedOpenFO) {
			var oPayload = {
				Action: "AssignFUtoOldFO",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightUnits: aSelectedFreightUnit,
				FreightOrders: aSelectedOpenFO
			};
			return oPayload;
		},
		onClosePlanOrConsolidateDialog: function (oEvent) {
			if (this._oPlanOrConsolidateDialog) {
				this._oPlanOrConsolidateDialog.close();
			}
		},
		//end Handle Dialog

		/**
		 * Event handler when user close Simulate dialog
		 * @public
		 */
		onSimClose: function () {
			this._oDialogSim.close();
		},

		/**
		 * Event handler when user clear messages in popover
		 * @public
		 */
		onClearMessagesButtonPressed: function () {
			this._clearMessages(this, "local");
		},

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */
		/**
		 * Method to convert javascript datetime object to String
		 * @private
		 */

		/* Support function for init flow */
		_prepareLocalModelForTheView: function () {
			// Model used to manipulate control states
			var oViewModel = new JSONModel({
				screenId: "fu",
				PlanningStatusKey: "All",
				tableNoDataText: this.oBundle.getText("tableNoDataText"),
				messagesLength: 0,
				aSelectedCarriers: [],
				aSelectedVendors: [],
				aPlanOrConsolidate: []
			});
			this.setModel(oViewModel, "local");
		},

		/**
		 * This method will prepare Planning Status Filter
		 * This method is not designed to be re-used
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to be included in Planning Status Filter
		 */
		_preparePlanningStatusFilters: function (oFilter) {
			//prevent duplicate filter
			var sPlaningStatusKey = this.getModel("local").getProperty("/PlanningStatusKey");
			var oUnPlannedFilter = DynamicFilter.buildPlaningStatusFilter("UnPlanned");
			var oPartiallyPlannedFilter = DynamicFilter.buildPlaningStatusFilter("PartiallyPlanned");
			var oPlannedFilter = DynamicFilter.buildPlaningStatusFilter("Planned");
			this._mPlanningStatusFilters = {
				All: oFilter,
				UnPlanned: (oFilter) ? new Filter({
					filters: [oFilter, oUnPlannedFilter],
					and: true
				}) : oUnPlannedFilter,
				PartiallyPlanned: (oFilter) ? new Filter({
					filters: [oFilter, oPartiallyPlannedFilter],
					and: true
				}) : oPartiallyPlannedFilter,
				Planned: (oFilter) ? new Filter({
					filters: [oFilter, oPlannedFilter],
					and: true
				}) : oPlannedFilter

			};
			return this._mPlanningStatusFilters;
		},

		/**
		 * This method will read data from "/xSERPTMxFreightUnitSet/$count" with aFilters for each type of PlanningStatus
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to read counters
		 */
		_readTheCountsForEachPlanningStatus: function (oAllFilter) {
			var oViewModel = this.getModel("local"),
				aPlanningStatusFilters = this._preparePlanningStatusFilters(oAllFilter);

			jQuery.each(aPlanningStatusFilters, function (sKey, oFilter) {
				this.getModel().read("/xSERPTMxFreightUnitSet/$count", {
					filters: (oFilter) ? [oFilter] : [],
					groupId: "xSERPTMxFreightUnitSet" + sKey,
					success: function (countData) {
						var sPath = "/" + sKey;
						oViewModel.setProperty(sPath, countData);
					},
					error: function (oError) {
						jQuery.sap.log.info("Odata Error occured: " + oError.toString());
					}
				});
			}.bind(this));
		}

	});
});