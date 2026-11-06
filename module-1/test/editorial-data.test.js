import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialDataView } from '../src/components/editorial-data.js';

const base = { id:'data', title:'Как изменилось?', scope:'Один показатель · один регион · недельные отметки', sources:[{label:'Архив',href:'https://example.com/?a=1&b=2'}] };

test('editorial data requires the measurement scope and verifiable source for both formats', () => {
  assert.throws(()=>editorialDataView({...base,scope:'',points:[{date:'Весна',label:'Событие'}]}),TypeError);
  assert.throws(()=>editorialDataView({...base,sources:[{label:'Источник',href:'javascript:alert(1)'}],type:'fact',value:'1',label:'Показатель'}),TypeError);
  assert.throws(()=>editorialDataView({...base,type:'fact',value:'1'}),TypeError);
});

test('timeline preserves source date precision, omitted values and escaped editorial labels', () => {
  const html=editorialDataView({...base,points:[{date:'Весна 2025',label:'<Первое событие>'},{date:'10 апреля',datetime:'2025-04-10',label:'Следующее событие'}]});
  assert(html.includes('<time>Весна 2025</time>'));
  assert(html.includes('datetime="2025-04-10"'));
  assert(html.includes('&lt;Первое событие&gt;'));
  assert.equal((html.match(/<li /g)||[]).length,2);
  assert(html.includes('href="https://example.com/?a=1&amp;b=2"'));
  const fact=editorialDataView({...base,type:'fact',value:'1-е место',label:'На 10 апреля 2025'});
  assert(fact.includes('1-е место')&&fact.includes(base.scope)&&fact.includes('На 10 апреля 2025'));
});
