import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Directive, Input, Output, EventEmitter } from '@angular/core';
import { ISlickRange, IColumnDefinition, IObservableCollection, IGridDataRow } from 'angular2-slickgrid';
import { Observable, Subject, Observer } from 'rxjs/Rx';

import * as TestUtils from './testUtils';
import { WebSocketEvent, ResultSetSubset, IRange } from './../src/js/interfaces';
import { DataService } from './../src/js/services/data.service';
import { ShortcutService } from './../src/js/services/shortcuts.service';
import { AppComponent } from './../src/js/components/app.component';
import * as Constants from './../src/js/constants';
import resultSetSmall from './testResources/mockResultSetSmall.spec';
import resultSetBig from './testResources/mockResultSetBig.spec';
import messageBatchStart from './testResources/mockMessageBatchStart.spec';
import messageResultSet from './testResources/mockMessageResultSet.spec';
import messageSimple from './testResources/mockMessageSimple.spec';
import messageError from './testResources/mockMessageError.spec';

const completeEvent = {
    type: 'complete',
    data: '00:00:00.388'
};
declare let rangy;

/**
 * Sends a sequence of web socket events to immitate the execution of a set of batches.
 * @param ds    The dataservice to send the websocket events
 * @param batchStartMessage The message sent at the start of a batch
 * @param resultMessage The message sent when a result set has completed
 * @param result    The result set event that completed
 * @param count The number of times to repeat the sequence of events
 */
function sendDataSets(ds: MockDataService, batchStartMessage: WebSocketEvent, resultMessage: WebSocketEvent, result: WebSocketEvent, count: number): void {
    for (let i = 0; i < count; i++) {
        // Send a batch start
        let batchStartEvent = <WebSocketEvent> JSON.parse(JSON.stringify(batchStartMessage));
        ds.sendWSEvent(batchStartEvent);

        // Send a result set completion
        let resultSetEvent = <WebSocketEvent> JSON.parse(JSON.stringify(result));
        resultSetEvent.data.id = i;
        resultSetEvent.data.batchId = i;
        ds.sendWSEvent(resultSetEvent);

        // Send a result set complete message
        let resultSetMessageEvent = <WebSocketEvent> JSON.parse(JSON.stringify(resultMessage));
        resultSetMessageEvent.data.batchId = i;
        ds.sendWSEvent(resultSetMessageEvent);
    }
}

// Mock Setup
class MockDataService {
    private _config = {
        'messagesDefaultOpen': true
    };
    private ws: WebSocket;
    public dataEventObs: Subject<WebSocketEvent>;

    constructor() {
        const self = this;
        this.ws = new WebSocket('ws://localhost:' + window.location.port + '/');
        let observable = Observable.create(
            (obs: Observer<MessageEvent>) => {
                self.ws.onmessage = obs.next.bind(obs);
                self.ws.onerror = obs.error.bind(obs);
                self.ws.onclose = obs.complete.bind(obs);

                return self.ws.close.bind(self.ws);
            }
        );

        let observer = {
            next: (data: Object) => {
                if (self.ws.readyState === WebSocket.OPEN) {
                    self.ws.send(JSON.stringify(data));
                }
            }
        };

        this.dataEventObs = Subject.create(observer, observable).map((response: MessageEvent): WebSocketEvent => {
            let data = JSON.parse(response.data);
            return data;
        });
    }

    get config(): Promise<{[key: string]: any}> {
        return Promise.resolve(this._config);
    }

    public sendWSEvent(data: any): void {
        this.ws.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(data)
        }));
    }

    public openLink(content: string, columnName: string, linkType: string): void {
        // No op
    }

    public getRows(start: number, numberOfRows: number, batchId: number, resultId: number): Observable<ResultSetSubset> {
        // no op
        return undefined;
    }

    public sendSaveRequest(batchIndex: number, resultSetNumber: number, format: string, selection: ISlickRange[]): void {
        // no op
    }

    public copyResults(selection: ISlickRange[], batchId: number, resultId: number): void {
        // no op
    }
    public getLocalizedTextsRequest(): Promise<{ [key: string]: any }> {
        return Promise.resolve({});
    }
}

class MockShortcutService {
    private _shortcuts = {
        'event.toggleMessagePane': 'ctrl+alt+r',
        'event.toggleResultPane': 'ctrl+alt+y'
    };

    stringCodeFor(event: string): Promise<string> {
        return Promise.resolve(this._shortcuts[event]);
    }

    getEvent(event: string): Promise<string> {
        return;
    }

    buildEventString(event: string): string {
        return;
    }
}

// MockSlickgrid
@Component({
    selector: 'slick-grid',
    template: ''
})
class MockSlickGrid {

    @Input() columnDefinitions: IColumnDefinition[];
    @Input() dataRows: IObservableCollection<IGridDataRow>;
    @Input() resized: Observable<any>;
    @Input() editableColumnIds: string[] = [];
    @Input() highlightedCells: {row: number, column: number}[] = [];
    @Input() blurredColumns: string[] = [];
    @Input() contextColumns: string[] = [];
    @Input() columnsLoading: string[] = [];
    @Input() overrideCellFn: (rowNumber, columnId, value?, data?) => string;
    @Input() showHeader: boolean = true;
    @Input() showDataTypeIcon: boolean = true;
    @Input() enableColumnReorder: boolean = false;
    @Input() enableAsyncPostRender: boolean = false;
    @Input() selectionModel: string = '';
    @Input() plugins: string[] = [];

    @Output() loadFinished: EventEmitter<void> = new EventEmitter<void>();
    @Output() cellChanged: EventEmitter<{column: string, row: number, newValue: any}> = new EventEmitter<{column: string, row: number, newValue: any}>();
    @Output() editingFinished: EventEmitter<any> = new EventEmitter();
    @Output() contextMenu: EventEmitter<{x: number, y: number}> = new EventEmitter<{x: number, y: number}>();

    @Input() topRowNumber: number;
    @Output() topRowNumberChange: EventEmitter<number> = new EventEmitter<number>();

    public _selection: ISlickRange[] | boolean;

    public getSelectedRanges(): ISlickRange[] {
        return [];
    }

    public setActive(): void {
        return;
    }

    public set selection(input: ISlickRange[] | boolean) {
        this._selection = input;
    }

}

@Component({
    selector: 'context-menu',
    template: ''
})
class MockContextMenu {
    @Output() clickEvent: EventEmitter<{type: string, batchId: number, resultId: number, index: number, selection: ISlickRange[]}>
        = new EventEmitter<{type: string, batchId: number, resultId: number, index: number, selection: ISlickRange[]}>();

    public emitEvent(event: {type: string, batchId: number, resultId: number, index: number, selection: ISlickRange[]}): void {
        this.clickEvent.emit(event);
    }

    public show(x: number, y: number, batchId: number, resultId: number, index: number, selection: ISlickRange[]): void {
        // No op
    }
}

@Component({
    selector: 'msg-context-menu',
    template: ''
})
class MockMessagesContextMenu {
    @Output() clickEvent: EventEmitter<{type: string, selectedRange: IRange}>
        = new EventEmitter<{type: string, selectedRange: IRange}>();

    public emitEvent(event: {type: string, selectedRange: IRange}): void {
        this.clickEvent.emit(event);
    }

    public show(x: number, y: number, selectedRange: IRange): void {
        // No op
    }
}

@Directive({
  selector: '[onScroll]'
})
class MockScrollDirective {
    @Input() scrollEnabled: boolean = true;
    @Output('onScroll') onScroll: EventEmitter<number> = new EventEmitter<number>();
}

@Directive({
  selector: '[mousedown]'
})
class MockMouseDownDirective {
    @Output('mousedown') onMouseDown: EventEmitter<void> = new EventEmitter<void>();
}
// End Mock Setup

////////  SPECS  /////////////
describe('AppComponent', function (): void {
    let fixture: ComponentFixture<AppComponent>;
    let comp: AppComponent;
    let ele: HTMLElement;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [ AppComponent, MockSlickGrid, MockContextMenu, MockMessagesContextMenu, MockScrollDirective, MockMouseDownDirective ]
        }).overrideComponent(AppComponent, {
            set: {
                providers: [
                    {
                        provide: DataService,
                        useClass: MockDataService
                    },
                    {
                        provide: ShortcutService,
                        useClass: MockShortcutService
                    }
                ]
            }
        });
    }));

    describe('Basic Startup', () => {

        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('initialized properly', () => {
            let messages = ele.querySelector('#messages');
            let results = ele.querySelector('#results');
            expect(messages).toBeDefined();
            expect(messages.className.indexOf('hidden')).toEqual(-1, 'messages not visible');
            expect(messages.getElementsByTagName('tbody').length).toBeGreaterThan(0, 'no table body in messages');
            expect(messages.getElementsByTagName('tbody')[0]
                           .getElementsByTagName('td')[1]
                           .innerText.indexOf(Constants.executeQueryLabel))
                           .not.toEqual(-1, 'Wrong executing label');
            expect(results).toBeNull('results pane is showing');
        });
    });

    describe('full initialization', () => {

        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('should have started showing messages after the batch start message', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            fixture.detectChanges();

            let results = ele.querySelector('#results');
            expect(results).toBeNull('results pane is visible');

            // Messages should be visible
            let messages = ele.querySelector('#messages');
            expect(messages).not.toBeNull('messages pane is not visible');
            expect(messages.className.indexOf('hidden')).toEqual(-1);
            expect(messages.getElementsByTagName('tr').length).toEqual(2);  // One for "started" message, one for spinner
            expect(messages.getElementsByTagName('a').length).toEqual(1);   // One link should be visible
        });

        it('should have initialized the grids correctly', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();

            // Results pane should be visible
            let results = ele.querySelector('#results');
            expect(results).not.toBeNull('results pane is not visible');
            expect(results.getElementsByTagName('slick-grid').length).toEqual(1);

            // Messages pane should be visible
            let messages = ele.querySelector('#messages');
            expect(messages).not.toBeNull('messages pane is not visible');
            expect(messages.className.indexOf('hidden')).toEqual(-1);
            expect(messages.getElementsByTagName('tr').length).toEqual(3);
            expect(messages.getElementsByTagName('a').length).toEqual(1);
        });
    });

    describe('spinner behavior', () => {
        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('should be visible at before any command', () => {
            fixture.detectChanges();

            // Spinner should be visible
            let spinner = ele.querySelector('#executionSpinner');
            expect(spinner).not.toBeNull('spinner is not visible');
        });

        it('should be visible after a batch starts', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            fixture.detectChanges();

            // Spinner should be visible
            let spinner = ele.querySelector('#executionSpinner');
            expect(spinner).not.toBeNull('spinner is not visible');
        });

        it('should be be visible after a result completes', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            fixture.detectChanges();

            // Spinner should be visible
            let spinner = ele.querySelector('#executionSpinner');
            expect(spinner).not.toBeNull('spinner is not visible');
        });

        it('should be hidden after a query completes', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();

            // Spinner should not be visible
            let spinner = ele.querySelector('#executionSpinner');
            expect(spinner).toBeNull('spinner is visible');
        });
    });

    describe('basic behavior', () => {

        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('should not hide message pane on click when there is no data', () => {
            let messages = <HTMLElement> ele.querySelector('#messages');
            expect(messages).not.toBeNull();
            expect(messages.className.indexOf('hidden')).toEqual(-1, 'messages not visible');
            messages.click();
            fixture.detectChanges();
            expect(messages.className.indexOf('hidden')).toEqual(-1, 'messages not visible');
        });

        it('should hide message pane on click when there is data', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let messages = <HTMLElement> ele.querySelector('#messages');
            expect(messages).not.toBeNull();
            expect(messages.className.indexOf('hidden')).toEqual(-1, 'messages not visible');
            let messagePane = <HTMLElement> ele.querySelector('#messagepane');
            messagePane.click();
            fixture.detectChanges();
            expect(messages.className.indexOf('hidden')).not.toEqual(-1);
        });

        it('should hide the results pane on click when there is data', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let results = <HTMLElement> ele.querySelector('#results');
            expect(results).not.toBeNull('results pane is not visible');
            expect(results.className.indexOf('hidden')).toEqual(-1);
            let resultspane = <HTMLElement> ele.querySelector('#resultspane');
            resultspane.click();
            fixture.detectChanges();
            expect(results.className.indexOf('hidden')).not.toEqual(-1);
        });

        it('should render all grids when there are alot but only subset of data', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            sendDataSets(dataService, messageBatchStart, messageResultSet, resultSetBig, 20);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let slickgrids = ele.querySelectorAll('slick-grid');
            expect(slickgrids.length).toEqual(20);
        });

        it('should render all grids when there are alot but only subset of data', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            sendDataSets(dataService, messageBatchStart, messageResultSet, resultSetSmall, 20);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let slickgrids = ele.querySelectorAll('slick-grid');
            expect(slickgrids.length).toEqual(20);
        });

        it('should open context menu when event is fired', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let contextmenu = comp.contextMenu;
            let slickgrid = comp.slickgrids.toArray()[0];
            spyOn(contextmenu, 'show');
            spyOn(slickgrid, 'getSelectedRanges').and.returnValue([]);
            slickgrid.contextMenu.emit({x: 20, y: 20});
            expect(slickgrid.getSelectedRanges).toHaveBeenCalled();
            expect(contextmenu.show).toHaveBeenCalledWith(20, 20, 0, 0, 0, []);
        });

        it('should open messages context menu when event is fired', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();

            let slickgrid = comp.slickgrids.toArray()[0];
            let msgContextMenu = comp.messagesContextMenu;
            let showSpy = spyOn(msgContextMenu, 'show');
            spyOn(slickgrid, 'getSelectedRanges').and.returnValue([]);

            let messageTable = ele.querySelector('#messageTable');
            let elRange = <IRange> rangy.createRange();
            elRange.selectNodeContents(messageTable);
            rangy.getSelection().setSingleRange(elRange);

            comp.openMessagesContextMenu({clientX: 20, clientY: 20, preventDefault: () => { return undefined; } });

            rangy.getSelection().removeAllRanges();

            expect(slickgrid.getSelectedRanges).not.toHaveBeenCalled();
            expect(msgContextMenu.show).toHaveBeenCalled();

            let range: IRange = showSpy.calls.mostRecent().args[2];
            expect(range).not.toBe(undefined);
        });
    });

    describe('Message Behavior', () => {
        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('Correctly Displays Simple Messages', () => {
            // Send a message that doesn't have error, indentation, or links
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageSimple);
            fixture.detectChanges();

            let messageRows = ele.querySelectorAll('.messageRow');
            let messageCells = ele.querySelectorAll('.messageRow > td');
            expect(messageRows.length).toEqual(1);                                      // Only one message row should be visible
            expect(messageCells.length).toEqual(2);                                     // Two cells should be visible

            let messageTimeCell = messageCells[0];
            expect(messageTimeCell.getElementsByTagName('span').length).toEqual(1);     // Time cell should be populated

            let messageValueCell = messageCells[1];
            expect(messageValueCell.classList.contains('errorMessage')).toEqual(false); // Message is not an error
            expect(messageValueCell.classList.contains('batchMessage')).toEqual(false); // Message should not be indented
            expect(messageValueCell.getElementsByTagName('a').length).toEqual(0);       // Message should not have a link
        });

        it('Correctly Displays Messages With Links', () => {
            // Send a message that contains a link
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            fixture.detectChanges();

            let messageRows = ele.querySelectorAll('.messageRow');
            let messageCells = ele.querySelectorAll('.messageRow > td');
            expect(messageRows.length).toEqual(1);                                      // Only one message row should be visible
            expect(messageCells.length).toEqual(2);                                     // Two cells should be visible

            let messageTimeCell = messageCells[0];
            expect(messageTimeCell.getElementsByTagName('span').length).toEqual(1);     // Time cell should be populated

            let messageValueCell = messageCells[1];
            expect(messageValueCell.classList.contains('errorMessage')).toEqual(false); // Message is not an error
            expect(messageValueCell.classList.contains('batchMessage')).toEqual(false); // Message should not be indented
            expect(messageValueCell.getElementsByTagName('a').length).toEqual(1);       // Message should have a link
        });

        it('Correctly Displays Messages With Indentation', () => {
            // Send a message that is indented under a batch start
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageResultSet);
            fixture.detectChanges();

            let messageRows = ele.querySelectorAll('.messageRow');
            let messageCells = ele.querySelectorAll('.messageRow > td');
            expect(messageRows.length).toEqual(1);                                      // Only one message row should be visible
            expect(messageCells.length).toEqual(2);                                     // Two cells should be visible

            let messageTimeCell = messageCells[0];
            expect(messageTimeCell.getElementsByTagName('span').length).toEqual(0);     // Time cell should not be populated

            let messageValueCell = messageCells[1];
            expect(messageValueCell.classList.contains('errorMessage')).toEqual(false); // Message is not an error
            expect(messageValueCell.classList.contains('batchMessage')).toEqual(true);  // Message should be indented
            expect(messageValueCell.getElementsByTagName('a').length).toEqual(0);       // Message should not have a link
        });

        it('Correctly Displays Messages With Errors', () => {
            // Send a message that is an error
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageError);
            fixture.detectChanges();

            let messageRows = ele.querySelectorAll('.messageRow');
            let messageCells = ele.querySelectorAll('.messageRow > td');
            expect(messageRows.length).toEqual(1);                                      // Only one message row should be visible
            expect(messageCells.length).toEqual(2);                                     // Two cells should be visible

            let messageTimeCell = messageCells[0];
            expect(messageTimeCell.getElementsByTagName('span').length).toEqual(1);     // Time cell should be populated

            let messageValueCell = messageCells[1];
            expect(messageValueCell.classList.contains('errorMessage')).toEqual(true);  // Message is an error
            expect(messageValueCell.classList.contains('batchMessage')).toEqual(false); // Message should not be indented
            expect(messageValueCell.getElementsByTagName('a').length).toEqual(0);       // Message should not have a link
        });
    });

    describe('test icons', () => {
        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('should send save requests when the icons are clicked', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            spyOn(dataService, 'sendSaveRequest');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let icons = ele.querySelectorAll('.gridIcon');
            expect(icons.length).toEqual(3);
            let csvIcon = <HTMLElement> icons[0].firstElementChild;
            csvIcon.click();
            expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'csv', []);
            let jsonIcon = <HTMLElement> icons[1].firstElementChild;
            jsonIcon.click();
            expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'json', []);
            let excelIcon = <HTMLElement> icons[2].firstElementChild;
            excelIcon.click();
            expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'excel', []);
        });

        it('should have maximized the grid when the icon is clicked', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetBig);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let slickgrids = ele.querySelectorAll('slick-grid');
            expect(slickgrids.length).toEqual(2);
            let icons = ele.querySelectorAll('.gridIcon');
            let maximizeicon = <HTMLElement> icons[0].firstElementChild;
            maximizeicon.click();
            setTimeout(() => {
                fixture.detectChanges();
                slickgrids = ele.querySelectorAll('slick-grid');
                expect(slickgrids.length).toEqual(1);
                done();
            }, 100);
        });
    });

    describe('test events', () => {

        beforeEach(() => {
            fixture = TestBed.createComponent<AppComponent>(AppComponent);
            fixture.detectChanges();
            comp = fixture.componentInstance;
            ele = fixture.nativeElement;
        });

        it('correctly handles custom events', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.toggleResultPane'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let results = <HTMLElement> ele.querySelector('#results');
            let event = new CustomEvent('gridnav', {
                            detail: {
                                which: 70,
                                ctrlKey: true,
                                metaKey: true,
                                shiftKey: true,
                                altKey: true
                            }
                        });
            window.dispatchEvent(event);
            setTimeout(() => {
                fixture.detectChanges();
                expect(results).not.toBeNull('message pane is not visible');
                expect(results.className.indexOf('hidden')).not.toEqual(-1);
                done();
            }, 100);
        });

        it('event toggle result pane', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.toggleResultPane'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let results = <HTMLElement> ele.querySelector('#results');
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(results).not.toBeNull('message pane is not visible');
                expect(results.className.indexOf('hidden')).not.toEqual(-1);
                done();
            }, 100);
        });

        it('event toggle message pane', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.toggleMessagePane'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let messages = <HTMLElement> ele.querySelector('#messages');
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(messages).not.toBeNull('message pane is not visible');
                expect(messages.className.indexOf('hidden')).not.toEqual(-1);
                done();
            }, 100);
        });

        it('event copy selection', (done) => {
            rangy.getSelection().removeAllRanges();

            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.copySelection'));
            spyOn(dataService, 'copyResults');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(dataService.copyResults).toHaveBeenCalledWith([], 0, 0);
                done();
            }, 100);
        });

        it('event copy with headers', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.copyWithHeaders'));
            spyOn(dataService, 'copyResults');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(dataService.copyResults).toHaveBeenCalledWith([], 0, 0, true);
                done();
            }, 100);
        });

        it('event copy messages', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.copySelection'));
            spyOn(dataService, 'copyResults');
            spyOn(document, 'execCommand').and.callThrough();
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();

            // Select the table under messages before sending the event
            let messageTable = ele.querySelector('#messageTable');
            let elRange = <IRange> rangy.createRange();
            elRange.selectNodeContents(messageTable);
            rangy.getSelection().setSingleRange(elRange);

            TestUtils.triggerKeyEvent(40, ele);

            setTimeout(() => {
                fixture.detectChanges();
                rangy.getSelection().removeAllRanges();

                expect(document.execCommand).toHaveBeenCalledWith('copy');
                expect(dataService.copyResults).not.toHaveBeenCalled();
                done();
            }, 100);
        });

        it('event maximize grid', (done) => {

            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.maximizeGrid'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetBig);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let slickgrids = ele.querySelectorAll('slick-grid');
            expect(slickgrids.length).toEqual(2);
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                slickgrids = ele.querySelectorAll('slick-grid');
                expect(slickgrids.length).toEqual(1);
                done();
            }, 100);
        });

        it('event save as json', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.saveAsJSON'));
            spyOn(dataService, 'sendSaveRequest');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'json', []);
                done();
            }, 100);
        });

        it('event save as csv', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.saveAsCSV'));
            spyOn(dataService, 'sendSaveRequest');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'csv', []);
                done();
            }, 100);
        });

        it('event save as excel', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <MockShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.saveAsExcel'));
            spyOn(dataService, 'sendSaveRequest');
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(dataService.sendSaveRequest).toHaveBeenCalledWith(0, 0, 'excel', []);
                done();
            }, 100);
        });

        it('event next grid', (done) => {

            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <ShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.nextGrid'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetBig);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let currentSlickGrid;
            let targetSlickGrid;
            targetSlickGrid = comp.slickgrids.toArray()[1];
            currentSlickGrid = comp.slickgrids.toArray()[0];
            spyOn(targetSlickGrid, 'setActive');
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(targetSlickGrid.setActive).toHaveBeenCalled();
                expect(currentSlickGrid._selection).toBe(false);
                done();
            });
        });

        it('event prev grid', (done) => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            let shortcutService = <ShortcutService> fixture.componentRef.injector.get(ShortcutService);
            spyOn(shortcutService, 'buildEventString').and.returnValue('');
            spyOn(shortcutService, 'getEvent').and.returnValue(Promise.resolve('event.prevGrid'));
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetBig);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetSmall);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            comp.navigateToGrid(1);
            let currentSlickGrid;
            let targetSlickGrid;
            targetSlickGrid = comp.slickgrids.toArray()[0];
            currentSlickGrid = comp.slickgrids.toArray()[1];
            spyOn(targetSlickGrid, 'setActive');
            TestUtils.triggerKeyEvent(40, ele);
            setTimeout(() => {
                fixture.detectChanges();
                expect(targetSlickGrid.setActive).toHaveBeenCalled();
                expect(currentSlickGrid._selection).toBe(false);
                done();
            });
        });

        it('event select all', () => {
            let dataService = <MockDataService> fixture.componentRef.injector.get(DataService);
            dataService.sendWSEvent(messageBatchStart);
            dataService.sendWSEvent(resultSetBig);
            dataService.sendWSEvent(messageResultSet);
            dataService.sendWSEvent(completeEvent);
            fixture.detectChanges();
            let slickgrid;
            slickgrid = comp.slickgrids.toArray()[0];
            comp.handleContextClick({type: 'selectall', batchId: 0, resultId: 0, index: 0, selection: []});
            fixture.detectChanges();
            expect(slickgrid._selection).toBe(true);
        });
    });
});
