sap.ui.define([
	"com/erpis/shiperp/dispute/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/dispute/hr7/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/Link",
	"sap/ui/core/MessageType",
	"com/erpis/shiperp/dispute/hr7/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, MessageToast, MessageBox, MessagePopover,
	MessagePopoverItem, Link, MessageType, Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.dispute.hr7.controller.DisputeList", {

		//Link to "com.erpis.shiperp.dispute.hr7.model.formatter" for formatter functions
		formatter: formatter,
		oBundle: null,
		//flag to determine the SmartFilterBar has been rendered or not
		_bSmartFilterBarRendered: false,

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			//1. When ever user go to the route "disputeList", trigger this._onObjectMatched()
			this.getRouter().getRoute("disputeList").attachPatternMatched(this._onObjectMatched, this);

			//2. Create message model
			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			//3. Local model for view
			this._prepareLocalModelForTheView();

			//4. Assign resource bundle
			this.oBundle = this.getResourceBundle();
		},

		_onObjectMatched: function () {
			this.showBusy();

			//There are scenarios when this method is triggered:
			//[Scenario 1]. It's the first time user navigate to this view (Ex: From homepage, user refresh)
			//In this scenario, the SmartFilterBar is not rendered yet, nothing happen. The binding of table dispute list
			//will be handled when the SmartFilterBar is rendered.
			//[Scenario 2]. It's the second time user navigate to this view (Ex: From details view, user go back to this view)
			if (this._bSmartFilterBarRendered) {
				this._readAllSmartFilterBarFiltersAndBindDisputeListTable();
			}
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		/**
		 * Called when the filterbar is initialized (only once).
		 * @public
		 */
		onFBInitialized: function (oEvent) {
			var oSmartFilterBar = oEvent.getSource();

			// Binding default date range for Invoice Date filter
			if (!this.oDateTimeRange) {
				this.oDateTimeRange = oSmartFilterBar.getControlByKey("CreatedDate");
			}
			this.oDateTimeRange.bindProperty("delimiter", {
				path: "local>/delimiterDRS1"
			});
			this.oDateTimeRange.bindProperty("dateValue", {
				path: "local>/firstDateValueDRS1"
			});
			this.oDateTimeRange.bindProperty("secondDateValue", {
				path: "local>/secondDateValueDRS1"
			});
			this.oDateTimeRange.bindProperty("displayFormat", {
				path: "local>/dateFormatDRS1"
			});
			this.oDateTimeRange.attachChange(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);

			// Binding company code list for company code filter
			if (!this.oInputCarrier) {
				this.oInputCarrier = oSmartFilterBar.getControlByKey("CarrierCode");
			}
			this.oInputCarrier.setShowValueHelp(true);
			this.oInputCarrier.setEnableMultiLineMode(true);
			this.oInputCarrier.addValidator(function (args) {
				var text = args.text;
				return new sap.m.Token({
					key: text,
					text: text
				});
			});
			this.oInputCarrier.attachTokenUpdate(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			this.oInputCarrier.attachValueHelpRequest(this.onOpenCarrierDialog, this);

			// Binding company code list for company code filter
			if (!this.oInputCompanycode) {
				this.oInputCompanycode = oSmartFilterBar.getControlByKey("CompanyCode");
			}
			this.oInputCompanycode.setShowValueHelp(true);
			this.oInputCompanycode.setEnableMultiLineMode(true);
			this.oInputCompanycode.addValidator(function (args) {
				var text = args.text;
				return new sap.m.Token({
					key: text,
					text: text
				});
			});
			this.oInputCompanycode.attachTokenUpdate(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			this.oInputCompanycode.attachValueHelpRequest(this.onOpenCompanyCodeDialog, this);

			// Handle when user input dispute ID on filter bar
			if (!this.oInputDisputeID) {
				this.oInputDisputeID = oSmartFilterBar.getControlByKey("ID");
				this.oInputDisputeID.attachLiveChange(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			}

			// Handle when user input Carrier Invoice Number on filter bar
			if (!this.oInputCarrierInvoiceNumber) {
				this.oInputCarrierInvoiceNumber = oSmartFilterBar.getControlByKey("InvoiceNo");
				this.oInputCarrierInvoiceNumber.attachLiveChange(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			}

			// Handle when user input Account Number on filter bar
			if (!this.oInputAccountNumber) {
				this.oInputAccountNumber = oSmartFilterBar.getControlByKey("AccountNo");
				this.oInputAccountNumber.attachLiveChange(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			}

			// Handle when user input Days Open on filter bar
			if (!this.oInputDaysOpen) {
				this.oInputDaysOpen = oSmartFilterBar.getControlByKey("DaysOpen");
				this.oInputDaysOpen.attachLiveChange(this._readAllSmartFilterBarFiltersAndBindDisputeListTable, this);
			}

			this._bSmartFilterBarRendered = true;
			// Read all SmartFilterBar filters and bind invoice list table
			this._readAllSmartFilterBarFiltersAndBindDisputeListTable();
		},

		// Carrier value help dialog handling
		onOpenCarrierDialog: function () {
			if (!this.oCarrierValueHelp) {
				this.oCarrierValueHelp = Utils.getFragment(null, "CarrierValueHelp", this);
				this.getView().addDependent(this.oCarrierValueHelp);
			}
			this.oCarrierValueHelp.getBinding("items").filter([]);
			this.oCarrierValueHelp.open();
		},

		// Carrier value help dialog handling
		handleCarrierSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Code", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		// Carrier value help dialog handling
		onHandleCarrierSelect: function (oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts && aContexts.length) {
				aContexts.map(function (oContext) {
					this.oInputCarrier.addToken(new sap.m.Token({
						key: oContext.getObject().Code,
						text: oContext.getObject().Code
					}));
				}.bind(this));
			}
			this.oInputCarrier.fireTokenUpdate();
			this.oInputCarrier.fireChange();
		},

		// Company code value help dialog handling
		onOpenCompanyCodeDialog: function () {
			if (!this.oCompanyCodeValueHelp) {
				this.oCompanyCodeValueHelp = Utils.getFragment(null, "CompanyCodeValueHelp", this);
				this.getView().addDependent(this.oCompanyCodeValueHelp);
			}
			this.oCompanyCodeValueHelp.getBinding("items").filter([]);
			this.oCompanyCodeValueHelp.open();
		},

		// Company code value help dialog handling
		handleCompanyCodeSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new sap.ui.model.Filter("CoCode", FilterOperator.Contains, sValue),
					new sap.ui.model.Filter("Name", FilterOperator.Contains, sValue)
				],
				and: false
			});
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		// Company code value help dialog handling
		onHandleCompanyCodeSelect: function (oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts && aContexts.length) {
				aContexts.map(function (oContext) {
					this.oInputCompanycode.addToken(new sap.m.Token({
						key: oContext.getObject().CoCode,
						text: oContext.getObject().CoCode
					}));
				}.bind(this));
			}
			this.oInputCompanycode.fireTokenUpdate();
			this.oInputCompanycode.fireChange();
		},

		/**
		 * Called when a variant is selected from a list.
		 * @public
		 */
		onAfterVariantLoaded: function () {
			this._onObjectMatched();
		},

		onDisputeIDPressed: function (oEvent) {
			var oItem = oEvent.getSource();
			this.getRouter().navTo("disputeDetail", {
				DisputeID: oItem.getBindingContext().getProperty("ID")
			}, false);
		},

		onPostButtonPressed: function () {
			var returnCode = this.checkIfAnyDisputeSelected();
			if (returnCode === -1) {
				return;
			}
			var sMsg = this.oBundle.getText("confirmPostMsg");
			var sTitle = this.oBundle.getText("confirmPostTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._doPostOrEDIOrPrintOrSendEmailDispute( /*Action Name*/ "POST");
					}
				}.bind(this)
			});
		},

		onCancelButtonPressed: function () {
			var returnCode = this.checkIfAnyDisputeSelected();
			if (returnCode === -1) {
				return;
			}
			var sMsg = this.oBundle.getText("confirmCancelMsg");
			var sTitle = this.oBundle.getText("confirmCancelTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._doCancelDispute();
					}
				}.bind(this)
			});
		},

		onEDIButtonPressed: function () {
			var returnCode = this.checkIfAnyDisputeSelected();
			if (returnCode === -1) {
				return;
			}
			var sMsg = this.oBundle.getText("confirmEDIMsg");
			var sTitle = this.oBundle.getText("confirmEDITitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._doPostOrEDIOrPrintOrSendEmailDispute( /*Action Name*/ "EDI");
					}
				}.bind(this)
			});
		},

		onPrintButtonPressed: function () {
			var returnCode = this.checkIfAnyDisputeSelected();
			if (returnCode === -1) {
				return;
			}
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			var sMsg = this.oBundle.getText("confirmPrintMsg");
			var sTitle = this.oBundle.getText("confirmPrintTitle");

			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [
					this.oBundle.getText("txtPrintOnly"),
					this.oBundle.getText("txtPrintAndProcess"),
					sap.m.MessageBox.Action.CANCEL
				],
				initialFocus: this.oBundle.getText("txtPrintOnly"),
				styleClass: bCompact ? "sapUiSizeCompact" : "",
				onClose: function (oAction) {
					if (oAction === this.oBundle.getText("txtPrintOnly")) {
						this._doPostOrEDIOrPrintOrSendEmailDispute( /*Action Name*/ "PRINT", "");
					} else if (oAction === this.oBundle.getText("txtPrintAndProcess")) {
						this._doPostOrEDIOrPrintOrSendEmailDispute( /*Action Name*/ "PRINT");
					}
				}.bind(this)
			});
		},

		onSendEmailButtonPressed: function () {
			var returnCode = this.checkIfAnyDisputeSelected();
			if (returnCode === -1) {
				return;
			}
			var sMsg = this.oBundle.getText("confirmEmailMsg");
			var sTitle = this.oBundle.getText("confirmEmailTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._doPostOrEDIOrPrintOrSendEmailDispute( /*Action Name*/ "EMAIL");
					}
				}.bind(this)
			});
		},

		onQuickFilter: function () {
			this._readAllSmartFilterBarFiltersAndBindDisputeListTable();
		},

		onTableDisputeListUpdateFinished: function (oEvent) {
			this.hideBusy();
			var sCompleteUrl = window.location.href;
			if (sCompleteUrl.indexOf("?Action=Open") !== -1) {
				this.byId("idIconTabBar").setSelectedKey("O");
				oEvent.getSource().getBinding("items").filter(new Filter("Status", FilterOperator.EQ, "O"));
			}
		},
		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */

		/**
		 * This method will bind {oTable} items with path from {sPath}, sorter {oSorter} and filtered by [aFilters] 
		 * This method is designed to be re-used anywhere. Prequisite: Template fragment must be created first
		 * @param {sap.m.Table} oTable The Table you want to bind
		 * @param {String} sPath The oData path to bind to aggregation "items" of oTable
		 * @param {sap.ui.model.Sorter} oSorter The sorter to sort oTable
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to filter oTable
		 * @private
		 */
		_formatDateObject: function (sDate) {
			var year = sDate.substring(0, 4);
			var month = sDate.substring(4, 6);
			var day = sDate.substring(6, 8);

			return sDate = year + '-' + month + '-' + day;
		},

		_bindItemsOnTableByServiceUrlAndFilter: function (oTable, sPath, oSorter, aFilters) {
			var oDeferred = $.Deferred();
			// Get Today for comparision
			var oToday = new Date();
			// var sday = String(oToday.getDate()).padStart(2, '0');
			// var smonth = String(oToday.getMonth() + 1).padStart(2, '0'); //January is 0!
			// var syear = oToday.getFullYear();
			// oToday = syear + smonth + sday;
			//Binding to DisputeListColumnListItem
			var oTemplate = sap.ui.xmlfragment("com.erpis.shiperp.dispute.hr7.fragment.DisputeListColumnListItem", this);
			this.showBusy();
			this.getModel().read("/xSERPERPxI_DPHDR", {
				success: function (oData) {
					if (oData.results.length !== 0) {
						this.getModel("local").setProperty("/DisputeListItemSet", oData.results);
						var aArrayDisputeList = this.getModel("local").getProperty("/DisputeListItemSet");
						aArrayDisputeList.forEach(function (item) {
							if (item.Status === "C") {
								var sCompletedDate = this._formatDateObject(item.CompletedDate);
								var sCreatedDate = this._formatDateObject(item.CreatedDate);

								var oCompletedDate = new Date(sCompletedDate);
								var oCreatedDate = new Date(sCreatedDate);

								var iCompletedDate = oCompletedDate.getTime();
								var iCreatedDate = oCreatedDate.getTime();
								item.DaysOpen = parseInt((iCompletedDate - iCreatedDate) / (24 * 3600 * 1000));
							} else {

								var sCreatedDate = this._formatDateObject(item.CreatedDate);
								var oCreatedDate = new Date(sCreatedDate);
								var iCreatedDate = oCreatedDate.getTime();
								var iToday = oToday.getTime();

								item.DaysOpen = parseInt((iToday - iCreatedDate) / (24 * 3600 * 1000));
							}
						}.bind(this));
						this.getModel("local").setProperty("/DisputeListItemSet", aArrayDisputeList);
						oDeferred.resolve();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
			$.when(oDeferred).done(function () {
				var oBindingInfo = {
					path: "local>/DisputeListItemSet",
					template: oTemplate,
					sorter: oSorter,
					filters: aFilters,
					parameters: {
						groupId: "DisputeHeaderEntitySet"
					}
				};
				oTable.bindItems(oBindingInfo);
				this.hideBusy();
			}.bind(this));
		},

		checkIfAnyDisputeSelected: function () {
			var oDisputeTable = this.getView().byId("idTableDisputeList");
			var aSelectedDisputes = oDisputeTable.getSelectedItems();
			if (aSelectedDisputes.length === 0) {
				MessageBox.error(this.oBundle.getText("noHdrSelectionMsg")); //"Please select a dispute");
				return -1;
			} else {
				return 1;
			}
		},

		/**
		 * This method will prepare a JSONModel with name "local" for this view. 
		 * This model will contains the number of disputes for each type of status 
		 * (Ex: "Open": 83 disputes, "In Process": 23 disputes)
		 */
		_prepareLocalModelForTheView: function () {
			// Prepare a date range from today to one year before
			var dateTo = new Date();

			var dateFrom = new Date();
			dateFrom.setUTCFullYear(dateTo.getFullYear() - 1);

			var oLocalModel = new JSONModel({
				//Default date range on smart filter bar
				delimiterDRS1: "to",
				dateFormatDRS1: "MM/dd/yyyy",
				firstDateValueDRS1: dateFrom,
				secondDateValueDRS1: dateTo,

				OpenDisputes: 0,
				InProcessDisputes: 0,
				CompletedDisputes: 0,
				CanceledDisputes: 0
			});
			this.setModel(oLocalModel, "local");
		},

		_readAllSmartFilterBarFiltersAndBindDisputeListTable: function () {
			var oDisputeListTable = this.getView().byId("idTableDisputeList");

			//1. Get all filters on SmartFilterBar. These filters will be used to filter dispute list table
			//and read the counts on table header
			var oSmartFilterBar = this.getView().byId("idDisputeListSmartFilterBar");
			this.aAllSmartFilterBarFilters = this._getAllFiltersOnSmartFilterBar(oSmartFilterBar);

			//1.1 Check the current selected IconTabFilter, if it's "All" tab, just continue and do nothing. 
			// If it's other tabs, include the "overall_status/approval_status" filter to the filter list 
			// for table content
			var sSelectedTab = this.getView().byId("idIconTabBar").getSelectedKey();
			var aAllSmartFiltersAndStatusFilter = this.aAllSmartFilterBarFilters;
			if (sSelectedTab !== "All" & sSelectedTab !== "") {
				var oStatusFilter = this._prepareSingleStatusFilter(sSelectedTab);
				aAllSmartFiltersAndStatusFilter.aFilters.push(oStatusFilter);
			}

			//2. Filter table invoice list by the filters on SmartFilterBars
			var sPath = "/xSERPERPxI_DPHDR";
			var oDisputeIDSorter = new sap.ui.model.Sorter("ID", /* bDescending */ false);
			this._bindItemsOnTableByServiceUrlAndFilter(oDisputeListTable, sPath, oDisputeIDSorter, aAllSmartFiltersAndStatusFilter);

			//3. Read the counts for each invoice status with filters on SmartFilterBar
			this.aAllSmartFilterBarFilters = this._getAllFiltersOnSmartFilterBar(oSmartFilterBar); //get all filters on smartFilterBar again because "this.aAllSmartFilterBarFilters" now has reference to "aAllSmartFiltersAndOverallStatusFilter"
			this._readTheCountsForEachDisputeStatus(this.aAllSmartFilterBarFilters);
		},

		/**
		 * This method will get all filters from param [oSmartFilterBar], put it in array and return this array.
		 * This method is designed to be re-used anywhere.
		 * @param {sap.ui.comp.smartfilterbar.SmartFilterBar} oSmartFilterBar The SmartFilterBar to read filters from
		 * @private
		 */
		_getAllFiltersOnSmartFilterBar: function (oSmartFilterBar) {
			// By assumption: the oSmartFilterBar will have following filters:
			// Position    Data Type           Key          		Meaning       
			// [0]         Date range          CreatedDate  		Created date
			// [1]         String          	  CarrierCode 	  	Carrier
			// [2]         String              CompanyCode       Company code
			// [3]         String              ID       			Dispute ID
			// [4]         String              InvoiceNo       	Carrier invoice number
			// [5]         String              AccountNo       	Account number
			// [6]         String              DaysOpen       	Days Open
			var aAllFilters = new Filter({
				filters: [],
				and: true
			});

			// 1.Construct Invoice Date Range filter
			var oBldatFilterSmartFilterBar = oSmartFilterBar.getControlByKey("CreatedDate");
			var oDateFrom = oBldatFilterSmartFilterBar.getFrom();
			var oDateFromTemp = new Date(oDateFrom);
			oDateFromTemp.setDate(oDateFromTemp.getDate() - 1);
			var oDateTo = oBldatFilterSmartFilterBar.getTo();
			var oDateToTemp = new Date(oDateTo);
			oDateToTemp.setDate(oDateToTemp.getDate() + 1);
			var sDateFrom = oDateFromTemp.toISOString().slice(0, 10).replace(/-/g, "");
			var sDateTo = oDateToTemp.toISOString().slice(0, 10).replace(/-/g, "");

			var oFilter = new Filter({
				filters: [
					new Filter("CreatedDate", FilterOperator.GE, sDateFrom),
					new Filter("CreatedDate", FilterOperator.LE, sDateTo)
				],
				and: true
			});
			aAllFilters.aFilters.push(oFilter);

			// 2.Construct Carrier List filter
			var aSelectedCarriers = oSmartFilterBar.getControlByKey("CarrierCode").getTokens();
			switch (aSelectedCarriers.length) {
			case 0:
				break;
			case 1:
				aAllFilters.aFilters.push(
					new Filter("CarrierCode", FilterOperator.EQ, aSelectedCarriers[0].getKey())
				);
				break;
				// Case user select more than 1 carrier
			default:
				var oCarrierFilter = new Filter({
					filters: [],
					and: false
				});
				for (var i = 0; i < aSelectedCarriers.length; i++) {
					oCarrierFilter.aFilters.push(
						new Filter("CarrierCode", FilterOperator.EQ, aSelectedCarriers[i].getKey())
					);
				}
				aAllFilters.aFilters.push(oCarrierFilter);
				break;
			}

			// 3.Construct Company code List filter
			var aSelectedCompanyCodes = oSmartFilterBar.getControlByKey("CompanyCode").getTokens();
			switch (aSelectedCompanyCodes.length) {
			case 0:
				break;
			case 1:
				aAllFilters.aFilters.push(
					new Filter("CompanyCode", FilterOperator.EQ, aSelectedCompanyCodes[0].getKey())
				);
				break;
				// Case user select more than 1 carrier
			default:
				var oCompanyCodeFilter = new Filter({
					filters: [],
					and: false
				});
				for (var j = 0; j < aSelectedCompanyCodes.length; j++) {
					oCompanyCodeFilter.aFilters.push(
						new Filter("CompanyCode", FilterOperator.EQ, aSelectedCompanyCodes[j].getKey())
					);
				}
				aAllFilters.aFilters.push(oCompanyCodeFilter);
				break;
			}

			// 4.Construct Dispute ID Filter.
			var sInputedDisputeID = oSmartFilterBar.getControlByKey("ID").getValue();
			if (sInputedDisputeID) {
				aAllFilters.aFilters.push(
					new Filter("ID", FilterOperator.Contains, sInputedDisputeID)
				);
			}

			// 5.Construct Dispute ID Filter.
			var sInputedCarrierInvoiceNumber = oSmartFilterBar.getControlByKey("InvoiceNo").getValue();
			if (sInputedCarrierInvoiceNumber) {
				aAllFilters.aFilters.push(
					new Filter("InvoiceNo", FilterOperator.Contains, sInputedCarrierInvoiceNumber)
				);
			}

			// 6.Construct Account Number Filter.
			var sInputedAccountNumber = oSmartFilterBar.getControlByKey("AccountNo").getValue();
			if (sInputedAccountNumber) {
				aAllFilters.aFilters.push(
					new Filter("AccountNo", FilterOperator.Contains, sInputedAccountNumber)
				);
			}

			// 7.Construct Days Open Filter.
			var sInputedDaysOpen = oSmartFilterBar.getControlByKey("DaysOpen").getValue();
			if (sInputedDaysOpen) {
				aAllFilters.aFilters.push(
					new Filter("DaysOpen", FilterOperator.EQ, sInputedDaysOpen)
				);
			}

			return aAllFilters;
		},

		// This method will read the number of disputes for each type of dispute status and put inside "local" model
		_readTheCountsForEachDisputeStatus: function (aFilters) {
			var oLocalModel = this.getModel("local"),
				i = 0,
				aDisputeStatusFilters = this._prepareDisputeStatusFilters(aFilters);
			jQuery.each(aDisputeStatusFilters, function (sKey, oFilter) {
				oLocalModel.setProperty("/" + sKey, "...");
				this.getModel().read("/xSERPERPxI_DPHDR/$count", {
					filters: oFilter,
					parameters: {
						groupId: "CountDisputeHeader",
						changeSetId: i + ""
					},
					success: function (oData) {
						var sPath = "/" + sKey;
						oLocalModel.setProperty(sPath, oData);
					},
					error: function (oError) {
						jQuery.sap.log.info("Odata Error occured: " + oError.toString());
					}
				});
				i++;
			}.bind(this));
		},

		/**
		 * This method will prepare Dipute Status filters
		 * This method is not designed to be re-used
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to be included in Dispute Status Filters (Ex: CarrierCode, Date From...)
		 */
		_prepareDisputeStatusFilters: function (aFilters) {
			var _mInvoiceStatusFilters;
			var aOpenFilters = [new Filter("Status", FilterOperator.EQ, "O")];
			var aInprocessFilters = [new Filter("Status", FilterOperator.EQ, "IP")];
			var aCompleteFilters = [new Filter("Status", FilterOperator.EQ, "C")];
			var aCancelFilters = [new Filter("Status", FilterOperator.EQ, "CN")];

			if (aFilters) {
				aOpenFilters.push(aFilters);
				aInprocessFilters.push(aFilters);
				aCompleteFilters.push(aFilters);
				aCancelFilters.push(aFilters);
			}

			_mInvoiceStatusFilters = {
				OpenDisputes: [new Filter({
					filters: aOpenFilters,
					and: true
				})],
				InProcessDisputes: [new Filter({
					filters: aInprocessFilters,
					and: true
				})],
				CompletedDisputes: [new Filter({
					filters: aCompleteFilters,
					and: true
				})],
				CanceledDisputes: [new Filter({
					filters: aCancelFilters,
					and: true
				})]
			};

			return _mInvoiceStatusFilters;
		},

		_prepareSingleStatusFilter: function (sSelectedKey) {
			var oFilter;
			switch (sSelectedKey) {
			case "O":
				oFilter = new sap.ui.model.Filter("Status", FilterOperator.EQ, "O");
				break;
			case "IP":
				oFilter = new sap.ui.model.Filter("Status", FilterOperator.EQ, "IP");
				break;
			case "C":
				oFilter = new sap.ui.model.Filter("Status", FilterOperator.EQ, "C");
				break;
			case "CN":
				oFilter = new sap.ui.model.Filter("Status", FilterOperator.EQ, "CN");
				break;
			default:
				break;
			}
			return oFilter;
		},

		/**
		 * This method will prepare a status filter from status key
		 */
		_getStatusFilterFromKey: function (sSelectedKey) {
			var oFilter;
			switch (sSelectedKey) {
			case "All":
				break;
			case "O": //Open
				oFilter = new Filter("Status", FilterOperator.EQ, "O");
				break;
			case "IP": //In Process
				oFilter = new Filter("Status", FilterOperator.EQ, "IP");
				break;
			case "C": //Completed
				oFilter = new Filter("Status", FilterOperator.EQ, "C");
				break;
			case "CN": //Cancel
				oFilter = new Filter("Status", FilterOperator.EQ, "CN");
				break;
			}
			return oFilter;
		},

		/**
		 * Internal method to cancel selected disputes
		 */
		_doCancelDispute: function () {
			this.showBusy();
			var aDisputes = this.byId("idTableDisputeList").getSelectedItems();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/CancelDisputeHeader", {
					method: "POST",
					urlParameters: {
						ID: oDispute.ID
					},
					groupId: "DisputeMassCancel",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeMassCancel",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbCancelSuccess"));
					}
					//2.Read the count again (because the number of "Open", "Canceled", "In Process" disputes may change) to display on icon tab bar
					this._readTheCountsForEachDisputeStatus(null);
					//3.Refresh the table dispute list
					this.byId("idTableDisputeList").getBinding("items").refresh();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Internal method to Post or EDI or Print or Send Email Dispute
		 * These actions are combined to one function because they're pratically calling the same function import from backend
		 */
		_doPostOrEDIOrPrintOrSendEmailDispute: function (sAction, sStatus) {
			this.showBusy();
			if (sStatus === undefined) {
				sStatus = "X";
			}
			var aDisputes = this.byId("idTableDisputeList").getSelectedItems();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/ProcessDisputeHeader", {
					method: "POST",
					urlParameters: {
						ID: oDispute.ID,
						Action: sAction,
						UpdateStatus: sStatus
					},
					groupId: "DisputeMassPostEDIPrint",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeMassPostEDIPrint",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						var sSuccessMsg = "";
						switch (sAction) {
						case "POST":
							sSuccessMsg = this.oBundle.getText("msbPostTitleSucess");
							break;
						case "EDI":
							sSuccessMsg = this.oBundle.getText("msbEDITitleSucess");
							break;
						case "PRINT":
							sSuccessMsg = this.oBundle.getText("msbPrintTitleSucess");
							break;
						case "EMAIL":
							sSuccessMsg = this.oBundle.getText("msbEmailTitleSucess");
							break;
						}

						MessageToast.show(sSuccessMsg);
					}
					//2.Read the count again (because the number of "Open", "Canceled", "In Process" disputes may change) to display on icon tab bar
					this._readTheCountsForEachDisputeStatus(null);
					//3.Refresh the table dispute list
					this.byId("idTableDisputeList").getBinding("items").refresh();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		}
	});
});