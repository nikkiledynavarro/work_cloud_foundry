sap.ui.define([
	"com/erpis/shiperp/freightaudit/hd6/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/freightaudit/hd6/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Token"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Token) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightaudit.hd6.controller.InvoiceList", {

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
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			this.sInvoice = "";
			// Local Model for view
			this._prepareLocalModelForTheView();

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			this.getRouter().getRoute("invoiceList").attachPatternMatched(this._onObjectMatched, this);
		},
		_onObjectMatched: function (oEvent) {
		
			var url = window.location.href;
			// var url =
			// 	"https://flpnwc-da56ca735.dispatcher.us2.hana.ondemand.com/sites?siteId=a4577ddc-ff44-41a6-b0c9-87437832bd34#FreightAudit-manage?InvoiceNo=12107";
			var aPiece = url.split("?");
			var sParam = aPiece[2].split("=");
			this.sInvoice = sParam[1];

		},
		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			this.checkSapUi5Version(this.byId("idIconTabBar"));
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onAssignedFiltersChanged: function (oEvent) {
			var oStatusText = sap.ui.getCore().byId(this.getView().getId() + "--statusText");
			var oFilterBar = sap.ui.getCore().byId(this.getView().getId() + "--smartFilterBar");
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		onBeforeVariantFetched: function (oEvent) {
			var oFilterData = oEvent.getSource().getFilterData();
			// Manually Update value for Delivery filter
			var aDelivery = [];
			var sDelivery = this.byId("txtDelivery").getValue();
			aDelivery.push({
				key: "Delivery",
				text: sDelivery
			});
			try {
				oFilterData.Delivery = {};
				oFilterData.Delivery.value = sDelivery;
				oFilterData.Delivery.ranges = [];
				oFilterData.Delivery.items = aDelivery;
			} catch (exc) {
				jQuery.sap.log.info("onBeforeVariantFetched has error while adding custom filter");
			}
			// Manually Update value for TrackingNo filter
			var aTrackingNo = [];
			var sTrackingNo = this.byId("txtTrackingNo").getValue();
			aTrackingNo.push({
				key: "TrackingNo",
				text: sTrackingNo
			});
			try {
				oFilterData.TrackingNo = {};
				oFilterData.TrackingNo.value = sTrackingNo;
				oFilterData.TrackingNo.ranges = [];
				oFilterData.TrackingNo.items = aTrackingNo;
			} catch (exc) {
				jQuery.sap.log.info("onBeforeVariantFetched has error while adding custom filter");
			}
			oEvent.getSource().setFilterData(oFilterData, true);
		},

		onBeforeTableRebind: function (oEvent) {
			var sCompleteUrl = window.location.href;
			if (sCompleteUrl.indexOf("?Action=Open") !== -1) {
				this.byId("idIconTabBar").setSelectedKey("Open");
			}
			var oInvoiceDateRange = this.getView().byId("smartFilterBar").getControlByKey("InvoiceDate");
			if (this.sInvoice) {
				this.getView().byId("smartFilterBar").getControlByKey("InvoiceNo").setTokens([new Token({
					text: "=" + this.sInvoice,
					key: this.sInvoice
				})]);
				this.sInvoice = "";
			}

			var sInvoiceNo = "";
			if (this.getView().byId("smartFilterBar").getControlByKey("InvoiceNo").getTokens().length > 0) {
				sInvoiceNo = this.getView().byId("smartFilterBar").getControlByKey("InvoiceNo").getTokens()[0].getKey();
			}
			var aFilterBindings = oEvent.getParameter("bindingParams").filters;
			//Add parameter to filter InvNo

			// If invoice date range has value
			if (oInvoiceDateRange.getFrom()) {
				var sFromDateString = this._convertDateTimeObjectToABAPString(oInvoiceDateRange.getFrom());
				var sToDateString = this._convertDateTimeObjectToABAPString(oInvoiceDateRange.getTo());
				var oInvoiceDateFilter = new Filter("InvoiceDate", FilterOperator.BT, sFromDateString, sToDateString);
				//Push invoice date range to list of filters
				if (aFilterBindings.length === 0) {
					if (oInvoiceDateFilter) {
						aFilterBindings.push(oInvoiceDateFilter);
					}
				} else {
					if (oInvoiceDateFilter) {
						var oNewFilter = new Filter([aFilterBindings[0], oInvoiceDateFilter], true);
						aFilterBindings[0] = oNewFilter;
					}
				}
			}
			if (sInvoiceNo) {
				var oInvoiceNoFilter = new Filter("InvoiceNo", FilterOperator.EQ, sInvoiceNo);
				aFilterBindings.push(oInvoiceNoFilter);
			}

			// Create match status filter
			var oMatchStatusFilter = this._buildMatchStatusFilter();
			if (oMatchStatusFilter) {
				//Push MathStatus filter to list of filters
				if (aFilterBindings.length === 0) {
					aFilterBindings.push(oMatchStatusFilter);
				} else {
					var oNewStatusFilter = new Filter([aFilterBindings[0], oMatchStatusFilter], true);
					aFilterBindings[0] = oNewStatusFilter;
				}
			}

			// Send filter values for Delivery and Tracking no in header request
			this.getModel().setHeaders({
				delivery: this.byId("txtDelivery").getValue(),
				trackingno: this.byId("txtTrackingNo").getValue()
			});

			// Read the count at this stage because all filters from filterbar are now available
			this._readTheCountsForEachInvoiceStatus(aFilterBindings.slice(0)[0]);

			// Adjust the Filter object to include approval status
			var oFilter;
			if (this.byId("idIconTabBar").getSelectedKey() === "Released") {
				oFilter = this._getReleasedFilter();
			} else if (this.byId("idIconTabBar").getSelectedKey() === "Disputed") {
				oFilter = this._getDisputedFilter();
			} else if (this.byId("idIconTabBar").getSelectedKey() === "Open") {
				oFilter = this._getOpenFilter();
			} else if (this.byId("idIconTabBar").getSelectedKey() === "Rejected") {
				oFilter = this._getRejectedFilter();
			}
			if (aFilterBindings.length === 0) {
				if (oFilter) {
					aFilterBindings.push(oFilter);
				}
			} else {
				if (oFilter) {
					var oAllFilter = new Filter([aFilterBindings[0], oFilter], true);
					aFilterBindings[0] = oAllFilter;
				}
			}
		},

		onShowOverlay: function (oEvent) {
			oEvent.getParameter("overlay").show = false;
		},

		onQuickFilter: function () {
			this.byId("smartFilterBar").fireSearch();
		},

		// Other events area
		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onInvoiceNumberLinkPressed: function (oEvent) {
			this.showBusy();
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler when user click on release button in footer
		 * @public
		 */
		onReleaseButtonPressed: function () {
			var sMsg = this.oBundle.getText("confirmReleaseMsg");
			var sTitle = this.oBundle.getText("confirmReleaseTitle");
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			if (aInvoice.length === 0) {
				MessageBox.error(this.oBundle.getText("noHdrSelectionMsg")); //"Please select an Invoice");
				return;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._releaseInvoice();
					}
				}.bind(this)
			});
		},

		/**
		 * Event handler when user click on cancel button in footer
		 * @public
		 */
		onCancelButtonPressed: function () {
			var sMsg = this.oBundle.getText("confirmCancelMsg");
			var sTitle = this.oBundle.getText("confirmCancelTitle");
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			if (aInvoice.length === 0) {
				MessageBox.error(this.oBundle.getText("noHdrSelectionMsg"));
				return;
			}

			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						var invoiceExists = false;
						for (var i = 0; i < aInvoice.length; i++) {
							var oBindingContext = aInvoice[i].getBindingContext();
							var oInvoice = oBindingContext.getObject();
							if (oInvoice.OverallStatus === "R") {
								invoiceExists = true;
								break;
							}
						}

						if (invoiceExists) {
							this._getReversalReason("com.erpis.shiperp.freightaudit.hd6.fragment.ReversalReasonDialog", "idInvoiceListReversalDialog");
						} else {
							this._cancelInvoice("00");
						}
					}
				}.bind(this)
			});
		},

		/**
		 * Event handler when user select a reversal reason while cancelling
		 * @public
		 */
		onReasonSelected: function (oEvent) {
			var params = oEvent.getParameters();
			var sReasonCode = params.selectedItem.getProperty("description");
			this._cancelInvoice(sReasonCode);
		},

		/**
		 * Event handler when user click update status footer
		 * @public
		 */
		onUpdateStatusButtonPressed: function () {
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();

			if (aInvoice.length === 0) {
				MessageBox.error(this.oBundle.getText("noHdrSelectionMsg"));
				return;
			}
			// Open the Table Setting dialog
			if (!this._oDialog) {
				this._oDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hd6.fragment.StatusDialogHdr", this);
				this.getView().addDependent(this._oDialog);
			}
			this._oDialog.open();
		},

		/**
		 * Event handler when user select a status to update from status dialog
		 * @public
		 */
		onStatusChange: function (oEvent) {
			var sStatusCode = oEvent.getParameters().selectedItem.getDescription();
			var sMsg = this.oBundle.getText("confirmSetStatusMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");

			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._setInvoiceStatus(sStatusCode);
					}
				}.bind(this)
			});
		},

		/**
		 * Event handler when user search a status from status dialog
		 * @public
		 */
		handleStatusHdrSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Name", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		/**
		 * Event handler when user click on Approve button at footer
		 * @public
		 */
		onApproveButtonPressed: function () {
			var sMsg = this.oBundle.getText("confirmSetStatusMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			if (aInvoice.length === 0) {
				MessageBox.error(this.oBundle.getText("noHdrSelectionMsg"));
				return;
			}

			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._setInvoiceStatus("A");
					}
				}.bind(this)
			});
		},

		/**
		 * Event handler when user click on Simulate button at footer
		 * @public
		 */
		onSimulateButtonPressed: function () {
			this.showBusy();
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			if (aInvoice.length !== 1) {
				MessageBox.error(this.oBundle.getText("simulteSelectionError"));
				this.hideBusy();
				return;
			}
			var oInvoice = aInvoice[0].getBindingContext().getObject();
			this.getModel().callFunction("/Simulate", {
				"method": "POST",
				urlParameters: {
					InvoiceNo: oInvoice.InvoiceNo,
					Vendor: oInvoice.Vendor,
					CompanyCode: oInvoice.CompanyCode
				},
				success: function (oData) {
					var oSimulateModel = new JSONModel();
					oSimulateModel.setData(oData);
					if (!this._oDialogSim) {
						this._oDialogSim = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hd6.fragment.SimulateGrid", this);
						this.getView().addDependent(this._oDialogSim);
					}
					this._oDialogSim.setModel(oSimulateModel, "simulateModel");
					this._oDialogSim.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

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

		/**
		 * Event handler when user click on AP Invoices button in the table entry
		 * @public
		 */
		onAPInvoiceNumberButtonPressed: function (oEvent) {
			// Open the Table Setting dialog
			if (!this._oAPInvoiceNumberDialog) { //=== undefined) {
				this._oAPInvoiceNumberDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hd6.fragment.APInvoiceNumberDialog", this);
				this._oAPInvoiceNumberDialog.setModel(this.getModel("i18n"), "i18n");
			}

			var oTheTableRowThatContainsThisButton = oEvent.getSource().getParent();
			var sBindingPath = oTheTableRowThatContainsThisButton.getBindingContext().getPath(); //sBindingPath should have format "/xSERPERPxI_FAHDR(InvoiceNo='xxx',Vendor='xxx')"
			var sTrackingOrderPath = sBindingPath + "/toDTL";
			var oTable = this._oAPInvoiceNumberDialog.getContent()[0];
			oTable.setBusy(true);

			//Prepare the dialog title
			var sDialogTitle = this.getModel("i18n").getProperty("APInvoiceNumber");
			var oTheCellThatContainsInvoiceNumber = oTheTableRowThatContainsThisButton.getCells()[1];
			var sInvNo = oTheCellThatContainsInvoiceNumber.getText();
			sDialogTitle = sDialogTitle + " (Inv No. " + sInvNo + " )";
			var oDialogData = {
				dialogTitle: sDialogTitle
			};
			var oDialogModel = new JSONModel(oDialogData);
			this._oAPInvoiceNumberDialog.setModel(oDialogModel);

			//Read data of Tracking Numbers
			this.getModel().read(sTrackingOrderPath, {
				success: function (oData) {
					//"this" is now bound to oTable
					var aReturnedResults = [];
					//filter results to get records that have "ObjectKey" only
					for (var i = 0; i < oData.results.length; i++) {
						//Check this APInvoice existed yet
						var bExisted = false;
						var thisTrackingOrder = oData.results[i];
						for (var j = 0; j < aReturnedResults.length; j++) {
							if (aReturnedResults[j].ObjectKey === thisTrackingOrder.ObjectKey) {
								bExisted = true;
								break;
							}
						}
						//If this tracking order ObjectKey is not empty and didn't exist in return results
						if (oData.results[i].ObjectKey !== "" && !bExisted) {
							aReturnedResults.push(thisTrackingOrder);
						}
					}
					var oJSONModel = new JSONModel(aReturnedResults);
					this.setModel(oJSONModel);
					this.setBusy(false);
				}.bind(oTable),
				error: function (oError) {
					jQuery.sap.log.info("Odata Error occured: " + oError.toString());
				}
			});

			this._oAPInvoiceNumberDialog.open();
		},

		/**
		 * Event handler when user close AP Invoices Dialog
		 * @public
		 */
		onCloseDialogAPInvoiceNumber: function () {
			//Clear table data (in case previous data existed)
			var oTable = this._oAPInvoiceNumberDialog.getContent()[0];
			var oJSONModel = new JSONModel();
			oTable.setModel(oJSONModel);
			this._oAPInvoiceNumberDialog.close();
		},

		onPreviewAPInvoice: function (oEvent) {
			var oFADtl = oEvent.getSource().getBindingContext().getObject();
			this.showBusy();
			this.getModel().callFunction("/PrintAPInvoice", {
				method: "POST",
				urlParameters: {
					Vendor: oFADtl.Vendor,
					InvoiceNo: oFADtl.InvoiceNo,
					APInvoice: oFADtl.ObjectKey
				},
				success: function (oData) {
					var sGuid = oData.Guid;
					if (sGuid) {
						MessageToast.show(this.oBundle.getText("APInvoicePreviewSuccess"));
						var sPath = this.getModel().sServiceUrl + "/APInvoicePrintSet(Guid='" + sGuid +
							"')/$value";
						sap.m.URLHelper.redirect(sPath, true);
					} else {
						MessageBox.error(this.oBundle.getText("NoAPInvoicePreview"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onFireSearch: function (oEvent) {
			this.byId("smartFilterBar").fireSearch();
		},

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */
		/**
		 * Method to convert javascript datetime object to String
		 * @private
		 */
		_convertDateTimeObjectToABAPString: function (oDate) {
			var sYear = oDate.getFullYear().toString();
			var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
			var sDay = ("0" + oDate.getDate()).slice(-2);
			return sYear + sMonth + sDay;
		},
		/**
		 * Method to do cancellation
		 * @public
		 */
		_cancelInvoice: function (sReason) {
			this.showBusy();
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			var oInvoice;
			var sDatetime = "";
			for (var i = 0; i < aInvoice.length; i++) {
				var sReasonUpdate = "00";
				oInvoice = aInvoice[i].getBindingContext().getObject();
				if (oInvoice.OverallStatus === "R") {
					sReasonUpdate = sReason;
				}
				sDatetime = oInvoice.ChangedDateTime;
				this.getModel().callFunction("/CancelHeader", {
					method: "POST",
					headers: {
						"If-Match": 'W/"\'' + sDatetime + '\'"'
					},
					urlParameters: {
						Vendor: oInvoice.Vendor,
						InvoiceNo: oInvoice.InvoiceNo,
						CompanyCode: oInvoice.CompanyCode,
						Reason: sReasonUpdate
					},
					groupId: "FAMassCancelHeader",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassCancelHeader",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbCancelSuccess"));
					}
					//2.Read the count again 
					this.byId("smartFilterBar").fireSearch();
					this.hideBusy();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Method to do status updating
		 * @public
		 */
		_setInvoiceStatus: function (sStatusCode) {
			this.showBusy();
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			var oInvoice;
			var sDatetime = "";
			for (var i = 0; i < aInvoice.length; i++) {
				oInvoice = aInvoice[i].getBindingContext().getObject();
				sDatetime = oInvoice.ChangedDateTime;
				this.getModel().callFunction("/SetHeaderStatus", {
					method: "POST",
					headers: {
						"If-Match": 'W/"\'' + sDatetime + '\'"'
					},
					urlParameters: {
						Vendor: oInvoice.Vendor,
						InvoiceNo: oInvoice.InvoiceNo,
						Status: sStatusCode
					},
					groupId: "FAMassUpdateHeaderStatus",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassUpdateHeaderStatus",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbUpdateStatusMsgSuccess"));
					}
					//2.Read the count again 
					this.byId("smartFilterBar").fireSearch();
					this.hideBusy();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Method to release invoice
		 * @public
		 */
		_releaseInvoice: function () {
			this.showBusy();
			var aInvoice = this.byId("smartTable").getTable().getSelectedItems();
			var oInvoice;
			var sDatetime = "";
			for (var i = 0; i < aInvoice.length; i++) {
				oInvoice = aInvoice[i].getBindingContext().getObject();
				sDatetime = oInvoice.ChangedDateTime;
				this.getModel().callFunction("/ReleaseHeader", {
					method: "POST",
					headers: {
						"If-Match": 'W/"\'' + sDatetime + '\'"'
					},
					urlParameters: {
						Vendor: oInvoice.Vendor,
						InvoiceNo: oInvoice.InvoiceNo,
						CompanyCode: oInvoice.CompanyCode
					},
					groupId: "FAMassReleaseHeader",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassReleaseHeader",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("msbReleaseTitleSucess"));
					}
					//2.Read the count again
					this.byId("smartFilterBar").fireSearch();
					this.hideBusy();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_showObject: function (oItem) {
			// Change Route to new master detail page
			this.getRouter().navTo("invoiceDetail", {
				//Mandt: oItem.getBindingContext().getProperty("mandt"),
				InvoiceNo: oItem.getBindingContext().getProperty("InvoiceNo"),
				Vendor: oItem.getBindingContext().getProperty("Vendor")
			}, false);
		},

		/* Support function for init flow */
		_prepareLocalModelForTheView: function () {
			// Model used to manipulate control states
			var oViewModel = new JSONModel({
				tableNoDataText: this.oBundle.getText("tableNoDataText"),
				messagesLength: 0,
				aSelectedCarriers: [],
				aSelectedVendors: []
			});
			this.setModel(oViewModel, "local");
		},

		/**
		 * This method will prepare Invoice Status filters
		 * This method is not designed to be re-used
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to be included in InvoiceStatus Filters
		 */
		_prepareInvoiceStatusFilters: function (oFilter) {
			var oOpenFilter = this._getOpenFilter();
			var oReleaseFilter = this._getReleasedFilter();
			var oRejectFilter = this._getRejectedFilter();
			var oDisputeFilter = this._getDisputedFilter();

			this._mInvoiceStatusFilters = {
				All: oFilter,
				Open: (oFilter) ? new Filter({
					filters: [oFilter, oOpenFilter],
					and: true
				}) : oOpenFilter,
				Rejected: (oFilter) ? new Filter({
					filters: [oFilter, oRejectFilter],
					and: true
				}) : oRejectFilter,
				Disputed: (oFilter) ? new Filter({
					filters: [oFilter, oDisputeFilter],
					and: true
				}) : oDisputeFilter,
				Released: (oFilter) ? new Filter({
					filters: [oFilter, oReleaseFilter],
					and: true
				}) : oReleaseFilter
			};
			return this._mInvoiceStatusFilters;
		},

		_getOpenFilter: function () {
			var oOpenFilter = new Filter([
				new Filter("OverallStatus", FilterOperator.EQ, "O"),
				new Filter("OverallStatus", FilterOperator.EQ, "RP")
			], false);
			return oOpenFilter;
		},

		_getReleasedFilter: function () {
			var oReleaseFilter = new Filter([
				new Filter("OverallStatus", FilterOperator.EQ, "R"),
				new Filter("OverallStatus", FilterOperator.EQ, "RM")
			], false);
			return oReleaseFilter;
		},

		_getRejectedFilter: function () {
			return new Filter("OverallStatus", FilterOperator.EQ, "RE");
		},

		_getDisputedFilter: function () {
			var oDisputeOtherFilter = new Filter([
				this._getRejectedFilter(),
				this._getReleasedFilter(),
				this._getOpenFilter()
			], false);
			var oOnlyDisputeFilter = new Filter("ApprovalStatus", FilterOperator.EQ, "D");
			var oDisputeFilter = new Filter([
				oDisputeOtherFilter,
				oOnlyDisputeFilter
			], true);
			return oDisputeFilter;
		},

		/**
		 * This method will read data from "/xSERPERPxI_FAHDR/$count" with aFilters for each type of Invoice Status
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter} aFilters The arrays of filters to read counters
		 */
		_readTheCountsForEachInvoiceStatus: function (oAllFilter) {
			var oViewModel = this.getModel("local"),
				aInvoiceStatusFilters = this._prepareInvoiceStatusFilters(oAllFilter);

			jQuery.each(aInvoiceStatusFilters, function (sKey, oFilter) {
				this.getModel().read("/xSERPERPxI_FAHDR/$count", {
					filters: (oFilter) ? [oFilter] : [],
					groupId: "FAHeaderEntitySet" + sKey,
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

		/**
		 * This method will build the match status filter based on toggle buttons on Filter Bar
		 * This method is not designed to be re-used.
		 */
		_buildMatchStatusFilter: function () {
			var oMatchStatusFilter = null;
			var bGreenButtonSelected = this.getView().byId("idTgActionSuccess").getPressed();
			var bYellowButtonSelected = this.getView().byId("idTgActionWarning").getPressed();
			var bYellowButtonSelected2 = this.getView().byId("idTgActionWarning2").getPressed();
			var bRedButtonSelected = this.getView().byId("idTgActionError").getPressed();
			var bRedButtonSelected2 = this.getView().byId("idTgActionError2").getPressed();
			var bRedButtonSelected3 = this.getView().byId("idTgActionError3").getPressed();

			var aFilters = [];
			if (bGreenButtonSelected) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'G'));
			}

			if (bYellowButtonSelected) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'Y1'));
			}
			if (bYellowButtonSelected2) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'Y3'));
			}

			if (bRedButtonSelected) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'R1'));
			}
			if (bRedButtonSelected2) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'R2'));
			}
			if (bRedButtonSelected3) {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, 'R3'));
			}
			if (aFilters.length > 0) {
				oMatchStatusFilter = new Filter(aFilters, false);
			}
			return oMatchStatusFilter;
		}

	});
});