import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ViewCell , LocalDataSource } from 'ng2-smart-table';
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';
import { WebSocketBridge } from 'django-channels';
import { AlarmService } from '../alarm.service';
import { Alarm, OperationalMode, Validity, Value } from '../alarm';
import { ISubscription } from "rxjs/Subscription";
import { StatusViewComponent } from '../status-view/status-view.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AckModalComponent } from '../ack-modal/ack-modal.component';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CdbService } from '../cdb.service';


/**
* Basic component to display alarms
*
* Note: This component is defined according to the ng2-smart-table component
*/
@Component({
  selector: 'app-alarms-table',
  templateUrl: './alarms-table.component.html',
  styleUrls: ['./alarms-table.component.css', './alarms-table.component.scss']
})
export class AlarmsTableComponent implements OnInit, OnDestroy {

  //TODO: Refactor general structure for alarms and components

  /**
  * Variables to follow the component subscriptions
  */
  private alarmServiceSubscription: ISubscription;
  private cdbServiceSubscription: ISubscription;

  public iasDataAvailable = new BehaviorSubject<any>(false);

  /**
  * Local data source for the alarms table
  */
  source: LocalDataSource;

  /**
  * Json that defines the sorting to be used in the table
  */
  sort: any;

  /**
  * Auxiliary list used to store the core_ids of alarms,
  * for displaying purposes
  */
  alarmIds = [];

  /**
  * Data table list
  */
  data = [];

  /**
  * Smart table settings
  */
  settings = {
    hideSubHeader: false,
    pager:{
      perPage: 50,
    },
    actions: false,
    rowClassFunction: (row) => { return 'clickable-row' },
    columns: {
      status: {
        title: 'Status',
        type: 'custom',
        renderComponent: StatusViewComponent
      },
      core_id: {
        title: 'Monitor Point',
        type: 'html',
        valuePrepareFunction: function(value){
            return '<div class="id-column"> '+value+' </div>'
        }
      },
      mode: {
        title: 'Mode'
      },
      timestamp: {
        title: 'Time'
      },
      short_desc: {
        title: 'Description',
        type: 'html',
        valuePrepareFunction: function(value){
            return '<div class="description-column"> '+value+' </div>'
        }
      }
    }
  };

  /**
  * The "constructor", injects the {@link AlarmService}
  *
  * @param {AlarmService} alarmService An instance of the AlarmService
  */
  constructor(private alarmService: AlarmService,
              private datePipe: DatePipe,
              private cdbService: CdbService,
              private modalService: NgbModal){
  }

  /**
  * Function executed when the component is initiated
  *
  * Starts the {@link AlarmService} and subscribes to its messages
  */
  ngOnInit() {
    this.sort = [
      {
        field: 'status',
        direction: 'asc'
      },
    ];
    this.source = new LocalDataSource(this.data);
    this.cdbServiceSubscription = this.cdbService.iasDataAvailable.subscribe(
      value => {
        this.iasDataAvailable.next(value);
        this.resetTable();
      }
    );
    this.alarmServiceSubscription = this.alarmService.alarmChangeStream.subscribe(notification => {
      this.alarmIds = Object.keys(this.alarmService.alarms);
      this.resetTable();  // TODO: Data load evaluation
    });
  }

  /**
  * Function executed when the component is destroyed
  */
  ngOnDestroy(){
    this.cdbServiceSubscription.unsubscribe();
    this.alarmServiceSubscription.unsubscribe();
  }

  /**
  * Function to build data according to the smart table format
  */
  getTableData(){
    this.clearTableData();
    for (let core_id of this.alarmIds){
      let alarm = this.alarmService.alarms[core_id];
      let alarmDescriptionInfo = '';
      if (this.iasDataAvailable.getValue() === true) {
        alarmDescriptionInfo = this.cdbService.getAlarmDescription(alarm.core_id);
      }

      let item = {
        status: this.getAlarmStatusTagsString(alarm),
        timestamp: this.dateFormat(alarm.getStateChangeTimestampAsDate()),
        core_id: alarm.core_id,
        mode: alarm.getModeAsString(),
        alarm: alarm,
        short_desc: alarmDescriptionInfo,
      };
      this.data.push(item);
    }
    return this.data;
  }

  /**
  * Clear data table
  */
  clearTableData(){
    this.data = []; // clear data
  }

  /**
  * Load data in the table
  */
  resetTable(){
    let data = this.getTableData();
    this.source.setSort(this.sort);
    this.source.load(data);
  }

  /**
  * Returns a given date formatted for displaying purposes
  */
  dateFormat(date){
    let stringDate = this.datePipe.transform(date, 'M/d/yy, h:mm:ss a');
    return stringDate;
  }

  /**
  * Return Alarm status tags
  */
  getAlarmStatusTagsString(alarm: Alarm): string {
    let value_tags = alarm.getValueAsString().split('_');
    let value = value_tags[0];
    let priority = value_tags[1];
    let validity = alarm.getValidityAsString();
    let ack = alarm.ack;
    let order = this.getAlarmStatusOrder(value, priority, validity, ack);

    let tags = [];
    tags.push(order);
    tags.push(alarm.getModeAsString());
    tags.push(value);
    if (priority != undefined) {
      tags.push(priority);
    }
    tags.push(validity);
    if (alarm.ack){
      tags.push('ack');
    }
    return tags.join('-');
  }

  getAlarmStatusOrder(value: string, priority: string, validity: string, ack: boolean): string {
    let order = 0;
    let priorities = ['critical', 'high', 'medium', 'low'];

    // SET:
    if (value == 'set') {
      if (validity == 'reliable') {
        if (ack == false) {
          order = priorities.indexOf(priority);
        }
        else {
          order = 4 + priorities.indexOf(priority);
        }
      }
      else {
        if (ack == false) {
          order = 8 + priorities.indexOf(priority);
        }
        else {
          order = 12 + priorities.indexOf(priority);
        }
      }
    }
    // CLEARED:
    else {
      if (validity == 'reliable') {
        if (ack == false) {
          order = 16;
        }
        else {
          order = 17;
        }
      }
      else {
        if (ack == false) {
          order = 18;
        }
        else {
          order = 19;
        }
      }
    }
    if (order < 10) {
      return ("0" + order);
    }
    else {
      return ("" + order);
    }
  }

  getPriorityNumber(priority: string) {
    let priorities = ['critical', 'high', 'medium', 'low'];
    return priorities.indexOf(priority);
  }

  arrayHasElement(array, element) {
    return array.indexOf(element) > -1 ? true : false;
  }


  /**
  * Handle click on table rows, it triggers the ack modal
  */
  onUserRowClick(event){
    let ackModal = this.modalService.open(AckModalComponent,
      { size: 'lg', centered: true }
    );
    ackModal.componentInstance.alarm = event.data.alarm;
    return ackModal;
  }

}
