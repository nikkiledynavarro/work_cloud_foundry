/*global location*/
sap.ui.define([
	"com/erpis/shiperp/freightaudit/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/freightaudit/hr7/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"com/erpis/shiperp/freightaudit/hr7/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightaudit.hr7.controller.InvoiceDetail", {

		formatter: formatter,
		oBundle: null, // i18n bundle class
		oPayAmtDialog: null,
		sFilterKey: "A",
		// Commonly used header properties
		sVendor: "",
		sInvoiceNo: "",
		sAccountNo: "",
		sCarrier: "",
		sCompanyCode: "",

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				aSelectedShippingPoints: [],
				approved: 0,
				open: 0,
				disputed: 0,
				released: 0
			});
			this.setModel(oViewModel, "local");

			var oStatModel = new JSONModel({
				results: [{
					Count: 0
				}, {
					Count: 0
				}, {
					Count: 0
				}]
			});
			this.setModel(oStatModel, "statsModel");

			this.getRouter().getRoute("invoiceDetail").attachPatternMatched(this._onObjectMatched, this);

			// add multi-input shipping point validator 
			this.byId("idShippingPtSelect").addValidator(function (args) {
				var sText = args.text;
				return new sap.m.Token({
					key: sText,
					text: sText
				});
			});

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
		},

		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			this.checkSapUi5Version(this.byId("idInvoiceDetailTab"));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.sVendor = oEvent.getParameter("arguments").Vendor;
			this.sInvoiceNo = oEvent.getParameter("arguments").InvoiceNo;
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("xSERPERPxI_FAHDR", {
					InvoiceNo: this.sInvoiceNo,
					Vendor: this.sVendor
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * Event handler when a tracking number gets pressed
		 * @public
		 */
		onTrackNumberLinkPressed: function (oEvent) {
			var oItem = oEvent.getSource();
			this.getRouter().navTo("conditionDetail", {
				InvoiceNo: this.sInvoiceNo,
				Vendor: this.sVendor,
				AccountNo: this.sAccountNo,
				CompanyCode: this.sCompanyCode,
				Carrier: this.sCarrier,
				TrackingNo: oItem.getBindingContext().getProperty("TrackingNo"),
				filterKey: this.sFilterKey
			});
		},

		/**
		 * Event handler when a dispute id link gets pressed
		 * @public
		 */
		onDisputeIDLinkPressed: function (oEvent) {
			var oNavService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			oNavService.toExternal({
				target: {
					shellHash: "#Dispute-manage&/DisputeDetail/" + oEvent.getSource().getText()
				}
			});
		},

		/**
		 * Event handler when a table cell gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPayamtPress: function (oEvent) {
			this.showBusy();
			var oSelectedTracking = oEvent.getSource().getBindingContext().getObject();
			this.getModel("local").setProperty("/selectedInvoiceDetail", oSelectedTracking);

			// Using for keeping old value of the line item being clicked.
			this.sOriginalPayAmt = oSelectedTracking.OriginalPayAmt;
			this.sCurrentPayamt = oSelectedTracking.PayAmount;
			this.bCurrentManual = oSelectedTracking.ManualPay;
			this.oCurrentTracking = oSelectedTracking;

			if (!this.oPayAmtDialog) {
				this.oPayAmtDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hr7.fragment.PayamtUpdate", this);
				this.getView().addDependent(this.oPayAmtDialog);
			}
			this.getModel().callFunction("/GetItemRemarks", {
				method: "POST",
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: oSelectedTracking.TrackingNo
				},
				success: function (oData) {
					// REFRESH Table Control
					this.hideBusy();
					this.sOriginalRemark = oData.Remarks;
					sap.ui.getCore().byId("txtRemark").setValue(oData.Remarks);
					this.oPayAmtDialog.open();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Event handler clear input when button press
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPayamtClear: function () {
			this.getModel("local").setProperty("/selectedInvoiceDetail/PayAmount", this.sOriginalPayAmt);
			var oRemarkInput = sap.ui.getCore().byId("txtRemark");
			oRemarkInput.setValue("");
			sap.ui.getCore().byId("cbManual").setSelected(false);
		},

		/**
		 * Event handler close dialog when button press
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPayamtClose: function () {
			this.oPayAmtDialog.close();
		},

		fnBeforeCloseDialog: function () {
			var oControl = sap.ui.getCore().byId("idPaymentAmountInput");
			oControl.setValueState(sap.ui.core.ValueState.None);
			oControl.setValueStateText("");
			oControl.setTooltip("");
		},

		fnValidateNumberic: function (oEvent) {
			var oControl = oEvent.getSource();
			var isValid = true;
			var oValue = oControl.getValue();
			if (oValue === "") {
				isValid = false;
			}
			// is number?
			if (isNaN(oValue)) {
				isValid = false;
			}
			if (oValue < 0) {
				isValid = false;
			}
			if (isValid) {
				oControl.setValueState(sap.ui.core.ValueState.None);
				oControl.setValueStateText("");
				oControl.setTooltip("");
			} else {
				oControl.setValueState(sap.ui.core.ValueState.Error);
				oControl.setValueStateText(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER"));
				oControl.setTooltip(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER_TOOLTIP"));
			}
		},
		/**
		 * Event handler save Payamt when button press
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPayamtSave: function () {
			this.showBusy();
			var bManual = "X";
			var sRemarkText = sap.ui.getCore().byId("txtRemark").getValue();
			var oPaymentAmountInput = sap.ui.getCore().byId("idPaymentAmountInput");
			if (oPaymentAmountInput.getValue() === "") {
				oPaymentAmountInput.setValueState("Error");
				oPaymentAmountInput.setValueStateText(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER"));
				oPaymentAmountInput.setTooltip(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER_TOOLTIP"));
				this.hideBusy();
				return;
			}

			var oSelectedInvoiceDetail = this.getModel("local").getProperty("/selectedInvoiceDetail");
			if (oSelectedInvoiceDetail.ManualPay === false) {
				if (oSelectedInvoiceDetail.PayAmount === oSelectedInvoiceDetail.OriginalPayAmt && sRemarkText === "") {
					bManual = "";
				}
			}
			var sDateTime = this.getView().getBindingContext().getObject().ChangedDateTime;
			this.getModel().callFunction("/SetItemPayAmount", {
				method: "POST",
				headers: {
					"If-Match": 'W/"\'' + sDateTime + '\'"'
				},
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: oSelectedInvoiceDetail.TrackingNo,
					PayAmount: oSelectedInvoiceDetail.PayAmount,
					Remarks: sRemarkText,
					ManualFlag: bManual
				},
				success: function () {
					// REFRESH Table Control
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					MessageToast.show(this.oBundle.getText("detailUpdatePayamtSuccess"));
					this.oPayAmtDialog.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.getView().getElementBinding().refresh();
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this._handleODataError(oError);
					this.oPayAmtDialog.close();
					this.hideBusy();
				}.bind(this)
			});
		},

		onClearMessages: function () {
			this._clearMessages(this, "local");
		},

		onQuickFilter: function (oEvent) {
			this.showBusy();
			var oSource = oEvent.getSource();
			var oBtnSuccess = this.byId("idTgActionSuccess");
			var oBtnWarning1 = this.byId("idTgActionWarning1");
			var oBtnWarning2 = this.byId("idTgActionWarning2");
			var oBtnError1 = this.byId("idTgActionError1");
			var oBtnError2 = this.byId("idTgActionError2");
			var oBtnError3 = this.byId("idTgActionError3");
			var oShippingPtMultiInpt = this.byId("idShippingPtSelect");
			var oStatusDtlSelect = this.byId("idStatusDtlSelect");
			this.sFilterKey = "A";
			var aFilters = [];
			// toggle button.
			if (oSource.getMetadata().getName() === "sap.m.ToggleButton" && oSource.getPressed() === true) {
				oBtnSuccess.setPressed(false);
				oBtnWarning1.setPressed(false);
				oBtnWarning2.setPressed(false);
				oBtnError1.setPressed(false);
				oBtnError2.setPressed(false);
				oBtnError3.setPressed(false);
				oSource.setPressed(true);
			}
			// get filter from toggle button.
			if (oBtnSuccess.getPressed()) {
				this.sFilterKey = oBtnSuccess.data("filter");
			} else if (oBtnWarning1.getPressed()) {
				this.sFilterKey = oBtnWarning1.data("filter");
			} else if (oBtnWarning2.getPressed()) {
				this.sFilterKey = oBtnWarning2.data("filter");
			} else if (oBtnError1.getPressed()) {
				this.sFilterKey = oBtnError1.data("filter");
			} else if (oBtnError2.getPressed()) {
				this.sFilterKey = oBtnError2.data("filter");
			} else if (oBtnError3.getPressed()) {
				this.sFilterKey = oBtnError3.data("filter");
			}
			if (this.sFilterKey !== "A") {
				aFilters.push(new Filter("MatchStatus", FilterOperator.EQ, this.sFilterKey));
			}
			// shipping Pt
			var aShippingPtTokens = oShippingPtMultiInpt.getTokens();
			if (aShippingPtTokens.length > 0) {
				var aFilterShpt = [];
				aShippingPtTokens.forEach(function (token) {
					aFilterShpt.push(new Filter("ShippingPoint", FilterOperator.EQ, token.getKey()));
				});
				aFilters.push(new Filter({
					filters: aFilterShpt,
					and: false
				}));
			}
			// status dtl
			if (oStatusDtlSelect.getSelectedKey()) {
				aFilters.push(new Filter("DetailStatus", FilterOperator.EQ, oStatusDtlSelect.getSelectedKey()));
			}
			if (aFilters.length > 1) {
				aFilters = [new Filter({
					filters: aFilters,
					and: true
				})];
			}
			this._handleQuickFilter(aFilters);
		},

		handleShippingPointSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("ShippingPoint", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		onReleasePress: function () {
			var sMsg = this.oBundle.getText("confirmReleaseDtlMsg");
			var sTitle = this.oBundle.getText("confirmReleaseTitle");
			var aInvoices = this.byId("idInvoiceDetailTab").getSelectedItems();
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}

			// Validate if one Tracking number is already approved/disputed. If yes, shouldn't allow dispute
			var bFlag = false;
			var oItem;
			for (var i = 0; i < aInvoices.length; i++) {
				oItem = aInvoices[i].getBindingContext().getObject();
				if (oItem.DetailStatus === "D") {
					bFlag = true;
					break;
				}
			}
			if (bFlag) {
				MessageBox.error(this.oBundle.getText("releaseActionNotAllowMessage"));
				return;
			}

			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._release(aInvoices);
					}
				}.bind(this)
			});
		},

		onReasonSelected: function (oEvent) {
			var params = oEvent.getParameters();
			var sReasonCode = params.selectedItem.getProperty("description");
			this._cancel(sReasonCode);
		},

		onCancelPress: function () {
			var aInvoices = this.byId("idInvoiceDetailTab").getSelectedItems();
			var sMsg = this.oBundle.getText("confirmCancelDtlMsg");
			var sTitle = this.oBundle.getText("confirmCancelTitle");
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}

			var isRelease = false;
			aInvoices.forEach(function (item) {
				var oData = item.getBindingContext().getObject();
				if (oData.ObjectKey !== "" && oData.ObjectKey !== undefined) {
					isRelease = true;
				}
			});
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction !== MessageBox.Action.OK) {
						return;
					}
					if (isRelease) {
						this._getReversalReason("com.erpis.shiperp.freightaudit.hr7.fragment.ReversalReasonDialog");
					} else {
						this._cancel("00");
					}
				}.bind(this)
			});
		},

		onOpenShippingPointDialog: function () {
			if (!this.oShippingPointValueHelp) {
				this.oShippingPointValueHelp = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hr7.fragment.ShippingPointValueHelp", this);
				this.getView().addDependent(this.oShippingPointValueHelp);
			}
			this.oShippingPointValueHelp.getBinding("items").filter([]);
			this.oShippingPointValueHelp.open();
		},

		onHandleShippingPointSelect: function (oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			var aSelectedShPoint = [];
			if (aContexts && aContexts.length) {
				aContexts.map(function (oContext) {
					aSelectedShPoint.push({
						key: oContext.getObject().ShippingPoint,
						text: oContext.getObject().ShippingPoint
					});
				});
			}
			this.getModel("local").setProperty("/aSelectedShippingPoints", aSelectedShPoint);
			this.byId("idShippingPtSelect").fireTokenUpdate();
		},

		onApprovePress: function () {
			var sMsg = this.oBundle.getText("confirmSetStatusDtlMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");
			var aInvoices = this.byId("idInvoiceDetailTab").getSelectedItems();
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}

			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._updateStatus("A");
					}
				}.bind(this)
			});
		},

		onDisputeListDialogSelect: function () {
			var oTable = sap.ui.getCore().byId(this.getView().createId("tbDisputeList"));
			if (oTable.getSelectedItems().length === 0) {
				MessageToast.show(this.oBundle.getText("errorNonSelectDisputeId"));
				return;
			}
			this.showBusy();
			var sPath = oTable.getSelectedItems()[0].getBindingContextPath();
			var oData = this.getModel("local").getProperty(sPath);
			this._createDispute(oData.DisputeID);
		},

		onDisputeListDialogClose: function () {
			this.oDisputeListDialog.close();
		},

		onDisputeListSearch: function (oEvent) {
			var sValue = oEvent.getSource().getValue("value");
			var oView = this.getView();
			var oFilter = new Filter("DisputeID", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = sap.ui.getCore().byId(oView.createId("tbDisputeList")).getBinding("items");
			oBinding.filter([oFilter]);
		},

		onDisputeListDialogCreate: function () {
			this.oDisputeListDialog.close();
			this._createDispute("");
		},

		onDisputePress: function () {
			var aInvoices = this.byId("idInvoiceDetailTab").getSelectedItems();
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}

			// Validate if all Tracking numbers are already approved/disputed. If yes, shouldn't allow dispute
			var bFlag = false;
			var oItem;
			for (var i = 0; i < aInvoices.length; i++) {
				oItem = aInvoices[i].getBindingContext().getObject();
				if (oItem.DetailStatus === "A" || oItem.DetailStatus === "D" || oItem.DetailStatus === "R") {
					bFlag = true;
					break;
				}
			}
			if (bFlag) {
				MessageBox.error(this.oBundle.getText("disputeActionNotAllowMessage"));
				return;
			}

			this.showBusy();
			this.getModel().callFunction("/GetConsolList", {
				method: "GET",
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					CompanyCode: this.sCompanyCode,
					Carrier: this.sCarrier,
					AccountNo: this.sAccountNo
				},
				success: function (oData) {
					this.getModel("local").setProperty("/disputeList", oData.results);

					if (oData.results.length === 0) {
						this._createDispute("");
						return;
					}
					this.oDisputeListDialog = Utils.getFragment(null, "DisputeListDialog", this);
					this.oDisputeListDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onUpdateStatusPress: function () {
			var aInvoices = this.byId("idInvoiceDetailTab").getSelectedItems();
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			// Open the Table Setting dialog
			if (!this._oDialog) {
				this._oDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hr7.fragment.StatusDialogDtl", this);
				this.getView().addDependent(this._oDialog);
			}
			this._oDialog.open();
		},

		onStatusChange: function (oEvent) {
			var sMsg = this.oBundle.getText("confirmSetStatusDtlMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");
			var mParams = oEvent.getParameters();
			var sStatusCode = mParams.selectedItem.getDescription();

			// fire dispute press in case of Dispute status is selected.
			if (sStatusCode === "D") {
				this.onDisputePress();
				return;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._updateStatus(sStatusCode);
					}
				}.bind(this)
			});
		},

		handleStatusDtlSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Name", FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		onTrackProUpdateFinished: function () {
			this.hideBusy();
		},

		onShowDeliveries: function (oEvent) {
			this.showBusy();
			var sTrackingNo = oEvent.getSource().getBindingContext().getObject().TrackingNo;
			this.getModel().callFunction("/GetTrackingDeliveries", {
				method: "GET",
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: sTrackingNo
				},
				success: function (oData) {
					if (oData.results.length === 0) {
						MessageBox.error("No delivery found for this tracking number " + sTrackingNo);
					} else {
						this.getModel("local").setProperty("/TrackingDeliveries", oData.results);
						if (!this._oTrackingDeliveryDialog) {
							this._oTrackingDeliveryDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hr7.fragment.TrackingDeliveryDialog", this);
							this.getView().addDependent(this._oTrackingDeliveryDialog);
						}
						this._oTrackingDeliveryDialog.open();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
				}.bind(this)
			});
		},

		onCloseTrackingDelivery: function () {
			this._oTrackingDeliveryDialog.close();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_createDispute: function (sDisputeID) {
			this.showBusy();
			var aTrackings = this.byId("idInvoiceDetailTab").getSelectedItems();
			var oTracking;
			for (var i = 0; i < aTrackings.length; i++) {
				oTracking = aTrackings[i].getBindingContext().getObject();
				this.getModel().callFunction("/DisputeItem", {
					method: "POST",
					urlParameters: {
						DisputeID: sDisputeID,
						Vendor: this.sVendor,
						InvoiceNo: this.sInvoiceNo,
						TrackingNo: oTracking.TrackingNo
					},
					groupId: "FAMassCreateDispute",
					changeSetId: "dispute"
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassCreateDispute",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("msbCreateDipsuteTitleSucess"));
					}
					// REFRESH Table Control
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					// update APV status
					this._getAPVStatusCount();
					this.oDisputeListDialog.close();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_handleQuickFilter: function (aFilters) {
			var oBinding = this.byId("idInvoiceDetailTab").getBinding("items");
			oBinding.filter(aFilters);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this)
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			this.sAccountNo = this.getView().getBindingContext().getObject().AccountNo;
			this.sCarrier = this.getView().getBindingContext().getObject().Carrier;
			this.sCompanyCode = this.getView().getBindingContext().getObject().CompanyCode;

			this.byId("idInvoiceDetailTab").getBinding("items").refresh();

			this._getStats(this.sVendor, this.sInvoiceNo);
			this._getAPVStatusCount();
		},

		_release: function (aItems) {
			this.showBusy();
			var oItem;
			for (var i = 0; i < aItems.length; i++) {
				oItem = aItems[i].getBindingContext().getObject();
				this.getModel().callFunction("/ReleaseItem", {
					method: "POST",
					urlParameters: {
						Vendor: this.sVendor,
						InvoiceNo: this.sInvoiceNo,
						TrackingNo: oItem.TrackingNo,
						PayAmount: oItem.PayAmount
					},
					groupId: "FAMassReleaseItem",
					changeSetId: "release"
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassReleaseItem",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("msbReleaseTitleSucess"));
					}
					// REFRESH Table Control
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					// update APV status
					this._getAPVStatusCount();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_cancel: function (sReason) {
			this.showBusy();
			var aTrackings = this.byId("idInvoiceDetailTab").getSelectedItems();
			var oTracking;
			for (var i = 0; i < aTrackings.length; i++) {
				oTracking = aTrackings[i].getBindingContext().getObject();
				this.getModel().callFunction("/CancelItem", {
					method: "POST",
					urlParameters: {
						Vendor: this.sVendor,
						InvoiceNo: this.sInvoiceNo,
						TrackingNo: oTracking.TrackingNo,
						Reason: sReason
					},
					groupId: "FAMassCancelItem",
					changeSetId: "cancel"
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassCancelItem",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbCancelSuccess"));
					}
					// REFRESH Table Control
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					// update APV status
					this._getAPVStatusCount();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_updateStatus: function (sStatusCode) {
			this.showBusy();
			var aTrackings = this.byId("idInvoiceDetailTab").getSelectedItems();
			var oTracking;
			var sDatetime;
			for (var i = 0; i < aTrackings.length; i++) {
				oTracking = aTrackings[i].getBindingContext().getObject();
				sDatetime = oTracking.ChangedDateTime;
				this.getModel().callFunction("/SetItemStatus", {
					method: "POST",
					headers: {
						"If-Match": 'W/"\'' + sDatetime + '\'"'
					},
					urlParameters: {
						Vendor: this.sVendor,
						InvoiceNo: this.sInvoiceNo,
						TrackingNo: oTracking.TrackingNo,
						Status: sStatusCode
					},
					groupId: "FAMassUpdateItemStatus",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "FAMassUpdateItemStatus",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbUpdateStatusMsgSuccess"));
					}
					// REFRESH Table Control
					this.byId("idInvoiceDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					// update APV status
					this._getAPVStatusCount();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_getStats: function (sVendor, sInvoiceNo) {
			var oStatModel = this.getModel("statsModel");
			this.getModel().callFunction("/GetStatisticFigures", {
				method: "POST",
				urlParameters: {
					Vendor: sVendor,
					InvoiceNo: sInvoiceNo
				},
				success: function (oData) {
					oStatModel.setData(oData);
				}.bind(this),
				error: function (oError) {
					oStatModel.setData({
						results: [{
							Count: 0
						}, {
							Count: 0
						}, {
							Count: 0
						}]
					});
				}.bind(this)
			});
		},

		_getAPVStatusCount: function () {
			// load approval status
			var aKeys = [{
				"prop": "approved",
				"value": "A"
			}, {
				"prop": "open",
				"value": "O"
			}, {
				"prop": "disputed",
				"value": "D"
			}, {
				"prop": "released",
				"value": "R"
			}];
			var fnLoadAPVStatusCount = function (index, item) {
				this.getModel().read("/xSERPERPxI_FADTL/$count", {
					filters: [
						new Filter({
							filters: [
								new Filter("DetailStatus", FilterOperator.EQ, item.value),
								new Filter("InvoiceNo", FilterOperator.EQ, this.sInvoiceNo),
								new Filter("Vendor", FilterOperator.EQ, this.sVendor)
							],
							and: true
						})
					],
					success: function (oData) {
						this.getModel("local").setProperty("/" + item.prop, parseInt(oData, 10));
					}.bind(this),
					error: function (oError) {
						this.getModel("local").setProperty("/" + item.prop, 0);
					}.bind(this)
				});
			}.bind(this);
			jQuery.each(aKeys, fnLoadAPVStatusCount);
		}
	});
});