// MMM-MonthlyCalendar.js

function el(tag, options) {
  var result = document.createElement(tag);

  options = options || {};
  for (var key in options) {
    result[key] = options[key];
  }

  return result;
}

function addOneDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

function diffDays(a, b) {
  a = new Date(a);
  b = new Date(b);
  
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

// Adapted from https://stackoverflow.com/a/6117889/245795
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - d.getUTCDay());
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function equals(a, b) {
  if (typeof(a) !== typeof(b)) {
    return false;
  }

  if (!!a && (a.constructor === Array || a.constructor === Object)) {
    for (var key in a) {
      if (!b.hasOwnProperty(key) || !equals(a[key], b[key])) {
        return false;
      }
    }

    return true;
  } else if (!!a && a.constructor == Date) {
    return a.valueOf() === b.valueOf();
  }

  return a === b;
}

function getLuminance(color) {
  try {
    const [r, g, b, a, s, d] = color.match(/([0-9.]+)/g);
    return 0.299 * +r + 0.587 * +g + 0.114 * +b;
  } catch {
    return 0;
  }
}

Module.register("MMM-MonthlyCalendar", {
  // Default module config
  defaults: {
    mode: "currentMonth",
    firstDayOfWeek: "sunday",
    showWeekNumber: false,
    displaySymbol: false,
    showLocations: false,
    wrapTitles: false,
    hideCalendars: [],
    luminanceThreshold: 110,
  },

  start: function() {
    var self = this;

    self.sourceEvents = {};
    self.events = [];
    self.displayedDay = null;
    self.displayedEvents = [];
    self.updateTimer = null;
    self.skippedUpdateCount = 0;
  },

  notificationReceived: function(notification, payload, sender) {
    var self = this;

    if (notification === "CALENDAR_EVENTS") {
      self.sourceEvents[sender.identifier] = payload.map(e => {
        e.startDate = new Date(+e.startDate);
        e.endDate = new Date(+e.endDate);

        if (e.fullDayEvent) {
          e.endDate = new Date(e.endDate.getTime() - 1000);

          if (e.startDate > e.endDate) {
            e.startDate = new Date(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate(), 1);
          } else {
            e.startDate = new Date(e.startDate.getTime() + 60 * 60 * 1000);
          }
        }

        return e;
      }).filter(e => {
        return !self.config.hideCalendars.includes(e.calendarName);
      });

      if (self.updateTimer !== null) {
        clearTimeout(self.updateTimer);
        ++self.skippedUpdateCount;
      }

      self.updateTimer = setTimeout(() => {
        var today = new Date().setHours(12, 0, 0, 0).valueOf();

        self.events = Object.values(self.sourceEvents).reduce((acc, cur) => acc.concat(cur), [])
          .sort((a, b) => {
            return a.startDate - b.startDate;
          });

        if (today !== self.displayedDay || !equals(self.events, self.displayedEvents)) {
          self.displayedDay = today;
          self.displayedEvents = self.events;
          self.updateTimer = null;
          self.skippedUpdateCount = 0;
          self.updateDom();
        }
      }, 5000);
    }
  },

  getStyles: function () {
    return ["MMM-MonthlyCalendar.css"];
  },

  getDom: function() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weeksToMonthDays = {
      "nextoneweek": 0,
      "currentweek": 0,
      "oneweek": 0,
      "twoweeks": 7,
      "threeweeks": 14,
      "fourweeks": 21,
      "nextfourweeks": 21,
    };
    const self = this;
    const now = new Date();
    const table = el("table", { "className": "small wrapper" });
    const today = now.getDate();
    const mode = self.config.mode.toLowerCase();
    let firstDayOfWeek = self.config.firstDayOfWeek.toLowerCase();
    var row = el("tr");
    var cell;
    var cellIndex, monthDays;
    var dateCells = [];
    var startDayOffset = 0;

    if (firstDayOfWeek === "today") {
      firstDayOfWeek = days[now.getDay()].toLowerCase();
    }

    while (firstDayOfWeek !== days[0].toLowerCase() && startDayOffset < days.length) {
      days.push(days.shift());
      ++startDayOffset;
    }

    startDayOffset = (startDayOffset % 7);

    if (mode in weeksToMonthDays) {
      cellIndex = today - now.getDay() + startDayOffset;
      while (cellIndex > today) {
        cellIndex -= 7;
      }
      monthDays = cellIndex + weeksToMonthDays[mode];
    } else {
      if (mode === "lastmonth") {
        now.setMonth(now.getMonth() - 1);
      } else if (mode === "nextmonth") {
        now.setMonth(now.getMonth() + 1);
      }
      cellIndex = 1 - new Date(now.getFullYear(), now.getMonth(), 1).getDay() + startDayOffset;
      monthDays = 32 - new Date(now.getFullYear(), now.getMonth(), 32).getDate();
      while (cellIndex > 1) {
        cellIndex -= 7;
      }
    }

    if (self.config.showWeekNumber) {
      row.appendChild(el("th", { "className": "weeknum" }));
    }

    for (var day = 0; day < 7; ++day) {
      const headerDate = new Date(now.getFullYear(), now.getMonth(), cellIndex + day);
      row.appendChild(el("th", { "className": "header", "innerHTML": headerDate.toLocaleString(config.language, { weekday: "short" }) }));
    }
    table.appendChild(row);

    for (var week = 0; week < 6 && cellIndex <= monthDays; ++week) {
      row = el("tr", { "className": "xsmall" });
      if (self.config.showWeekNumber) {
        const weekDate = new Date(now.getFullYear(), now.getMonth(), cellIndex);
        row.appendChild(el("td", { "className": "weeknum", "innerHTML": getWeekNumber(weekDate) }));
      }

      for (day = 0; day < 7; ++day, ++cellIndex) {
        var cellDate = new Date(now.getFullYear(), now.getMonth(), cellIndex);
        var cellDay = cellDate.getDate();

        cell = el("td", { "className": "cell" });
        if (["lastmonth", "nextmonth"].includes(mode)) {
          // Do nothing
        } else if (cellIndex === today) {
          cell.classList.add("today");
        } else if (cellIndex !== cellDay && mode === "currentmonth") {
          cell.classList.add("other-month");
        } else if (cellIndex < today) {
          cell.classList.add("past-date");
        }

	var dayNumDay = cellDay;
        if ((week === 0 && day === 0) || cellDay === 1) {
          cellDay = cellDate.toLocaleString(config.language, { month: "short", day: "numeric" });
        }

        cell.appendChild(el("div", { "id": "dayNum" + dayNumDay, "className": "day-num", "innerHTML": cellDay }));
        row.appendChild(cell);
        dateCells[cellIndex] = cell;
      }

      table.appendChild(row);
    }

    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var monthEnd = new Date(now.getFullYear(), now.getMonth(), monthDays, 23, 59, 59);
    // console.log(self.events);
    for (var i in self.events) {
      var e = self.events[i];
      //console.log(e);
      e.isMultiDay = (e.startDate.getDate() != e.endDate.getDate());
	   
      // console.log(e);
      for (var eventDate = e.startDate; eventDate <= e.endDate; eventDate = addOneDay(eventDate)) {
        var dayDiff = diffDays(eventDate, monthStart);

        if (dayDiff in dateCells) {
          let div = el("div", { "className": "event" });

	  if(e.fullDayEvent) {
	    div.className = 'event-full';
	  }

          if (!self.config.wrapTitles) {
            div.classList.add("event-nowrap");
          }

          if (!e.fullDayEvent) {
            function formatTime(d) {
              var h = d.getHours();
              var m = d.getMinutes().toString().padStart(2, "0");
              if (config.timeFormat === 12) {
                return (h % 12 || 12) + (m > 0 ? `:${m}` : "") + (h < 12 ? "am" : "pm");
              } else {
                return `${h}:${m}`;
              }
            }
	    
	    //if(e.calendarName != 'dinner' && e.calendarName != 'events') {
	    if(!e.hideCalendarName) {
	      if(self.config.displaySymbol) {
	        for(let symbol of e.symbol) {
	          div.appendChild(el("span", { "className": `event-label partial fa fa-${symbol}`, "style": "color: " + e.color + ";"  }));
		}
	      }
              //div.appendChild(el("div", { "className": "event-label", "style": "background-color: " + e.bgColor + "; color: " + e.color + ";", "innerText": formatTime(e.startDate) + " | " + e.calendarName }));
              div.appendChild(el("div", { "className": "event-label", "style": "background-color: " + e.bgColor + "; color: " + e.color + ";", "innerText": formatTime(e.startDate )}));
	    }
	    else {
              div.appendChild(el("div", { "className": "event-label", "style": "background-color: " + e.bgColor + "; color: " + e.color + ";", "innerText": formatTime(e.startDate )}));
	    }

	  }

          //if (self.config.displaySymbol) {
          //  for (let symbol of e.symbol) {
          //    div.appendChild(el("span", { "className": `event-label fa fa-${symbol}` }));
          //  }
          //}

	  // console.log(e);
	  if(e.fullDayEvent) {
	    var eventTitle = e.title;
	
            if (self.config.displaySymbol) {
              for (let symbol of e.symbol) {
                div.appendChild(el("span", { "className": `event-label fa fa-${symbol}` }));
		//eventTitle = '<i class="event-label fa fa-${symbol)"></i> ' + eventTitle;
              }
            }

	    // todo: allow specifying text to append or prepend to titles in config rather than hard coded
	    //if(e.calendarName == 'birthdays') {
	    //  eventTitle = eventTitle + '\'s Birthday';;
	    //}

            div.appendChild(el("div", { "className": "event-title", "innerText": eventTitle }));
		  
	  }
	  else { 
            // div.appendChild(el("div", { "className": "event-title", "style": "border: " + e.color + " 1px solid;", "innerText": e.title }));
            div.appendChild(el("div", { "className": "event-title", "style": "background-color: " + e.bgColor + "; color: " + e.color +  ";", "innerText": e.title }));
	  }

	  if(this.config.showLocations && e.location && e.fullDayEvent && e.calendarName != 'us_holiday') {
	    div.appendChild(el("div", { "className": "event-location-full", "style": "background-color: " + e.bgColor + "; color: " + e.color +  ";", "innerText": e.location }));
	  }
	  else if(this.config.showLocations && e.location && e.calendarName != 'us_holiday') {
	    div.appendChild(el("div", { "className": "event-location", "style": "background-color: " + e.bgColor + "; color: " + e.color +  ";", "innerText": e.location }));
	  }

	  // console.log(e.startDate);
	  // console.log(e.endDate);
	  // console.log(e.startDate.getDate());
	  // console.log(dayDiff);
          if (e.color) {
            var c = e.color;

            if (e.fullDayEvent) {
	      if(e.bgColor) {
	        div.style.backgroundColor = e.bgColor;
		div.style.color = e.color;
	      }
	      else {
                div.style.backgroundColor = c;
                if (getLuminance(div.style.backgroundColor) >= self.config.luminanceThreshold) {
                  div.style.color = "black";
                }
	      }
            } else {
	      // console.log(div);
              // div.style.color = c;
	      // div.style.border = c + ' 1px solid';
            }
          }
	 

		//console.log(dateCells[dayDiff].firstChild);
	
	  // todo: allow specifying calendar name to move to top as variable in config
	  // todo: allow multiple calendars to be pinned at top, in whatever order specified
	  if(e.fullDayEvent && e.calendarName == 'dinner') {	
	    var element = dateCells[dayDiff].firstChild;
	    if(element.classList[0] == 'day-num') {
	      dateCells[dayDiff].removeChild(element);
	    }

	    dateCells[dayDiff].prepend(div);
	    dateCells[dayDiff].prepend(element);

	  }
	  else {
            dateCells[dayDiff].appendChild(div);
	  }
        }
      }
    }

    return table;
  },
});
