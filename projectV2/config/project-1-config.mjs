export const config = {
  "meta": {
    "fetchedAt": "2026-03-27T11:55:05.916Z",
    "organization": "chTestOrg",
    "projectNumber": 1
  },
  "project": {
    "id": "PVT_kwDODFU6284BNtif",
    "title": "org-dev-board",
    "fields": {
      "title": {
        "id": "PVTF_lADODFU6284BNtifzg8oHuc",
        "type": "TITLE"
      },
      "assignees": {
        "id": "PVTF_lADODFU6284BNtifzg8oHug",
        "type": "ASSIGNEES"
      },
      "branch": {
        "id": "PVTSSF_lADODFU6284BNtifzg99Wp4",
        "type": "SINGLE_SELECT",
        "options": {
          "stage": {
            "id": "8f95f259",
            "name": "stage"
          },
          "prerelease": {
            "id": "049fbca0",
            "name": "prerelease"
          },
          "master": {
            "id": "0f85fee4",
            "name": "master"
          },
          "main": {
            "id": "3ad8ce07",
            "name": "main"
          }
        }
      },
      "status": {
        "id": "PVTSSF_lADODFU6284BNtifzg8oHuk",
        "type": "SINGLE_SELECT",
        "options": {
          "todo": {
            "id": "f75ad846",
            "name": "Todo"
          },
          "in_progress": {
            "id": "47fc9ee4",
            "name": "In Progress"
          },
          "review": {
            "id": "4e894332",
            "name": "Review"
          },
          "qa": {
            "id": "4ab3a03e",
            "name": "QA"
          },
          "completed": {
            "id": "93dd628f",
            "name": "Completed"
          },
          "done": {
            "id": "98236657",
            "name": "Done"
          },
          "planned": {
            "id": "5fda1861",
            "name": "Planned"
          }
        }
      },
      "labels": {
        "id": "PVTF_lADODFU6284BNtifzg8oHuo",
        "type": "LABELS"
      },
      "linked_pull_requests": {
        "id": "PVTF_lADODFU6284BNtifzg8oHus",
        "type": "LINKED_PULL_REQUESTS"
      },
      "milestone": {
        "id": "PVTF_lADODFU6284BNtifzg8oHuw",
        "type": "MILESTONE"
      },
      "repository": {
        "id": "PVTF_lADODFU6284BNtifzg8oHu0",
        "type": "REPOSITORY"
      },
      "reviewers": {
        "id": "PVTF_lADODFU6284BNtifzg8oHu8",
        "type": "REVIEWERS"
      },
      "parent_issue": {
        "id": "PVTF_lADODFU6284BNtifzg8oHvA",
        "type": "PARENT_ISSUE"
      },
      "subissues_progress": {
        "id": "PVTF_lADODFU6284BNtifzg8oHvE",
        "type": "SUB_ISSUES_PROGRESS"
      },
      "priority": {
        "id": "PVTSSF_lADODFU6284BNtifzg8sdwI",
        "type": "SINGLE_SELECT",
        "options": {
          "blocker": {
            "id": "59339976",
            "name": "⛔ Blocker"
          },
          "critical": {
            "id": "71061741",
            "name": "🔥 Critical"
          },
          "high": {
            "id": "d09c87e5",
            "name": "🟡 High"
          },
          "medium": {
            "id": "0fa891aa",
            "name": "🟢 Medium"
          },
          "low": {
            "id": "53e86365",
            "name": "🔵 Low"
          },
          "trivial": {
            "id": "da6f957d",
            "name": "⚪ Trivial"
          }
        }
      },
      "status_qa_board": {
        "id": "PVTSSF_lADODFU6284BNtifzg8-fqE",
        "type": "SINGLE_SELECT",
        "options": {
          "rejected": {
            "id": "d726087e",
            "name": "Rejected"
          },
          "stand_by": {
            "id": "43e7215b",
            "name": "Stand by"
          },
          "todo": {
            "id": "0453b297",
            "name": "Todo"
          },
          "in_progress": {
            "id": "cd63e639",
            "name": "In Progress"
          },
          "tested": {
            "id": "9e700621",
            "name": "Tested"
          }
        }
      },
      "status_autotest_board": {
        "id": "PVTSSF_lADODFU6284BNtifzg8-hFw",
        "type": "SINGLE_SELECT",
        "options": {
          "need_automated": {
            "id": "76fb011e",
            "name": "Need Automated"
          },
          "automation": {
            "id": "1ff82e4e",
            "name": "Automation"
          },
          "automated": {
            "id": "9f7a4f00",
            "name": "Automated"
          }
        }
      },
      "application": {
        "id": "PVTSSF_lADODFU6284BNtifzg9GKP0",
        "type": "SINGLE_SELECT",
        "options": {
          "xtiles_web": {
            "id": "15216bc3",
            "name": "xTiles Web"
          },
          "webclipper": {
            "id": "4c99ea9d",
            "name": "WebClipper"
          },
          "desktopapp": {
            "id": "5de545a0",
            "name": "DesktopApp"
          }
        }
      },
      "release_version": {
        "id": "PVTF_lADODFU6284BNtifzg96gdA",
        "type": "TEXT"
      },
      "environment": {
        "id": "PVTSSF_lADODFU6284BNtifzg_z_5Q",
        "type": "SINGLE_SELECT",
        "options": {
          "stage": {
            "id": "77010ce7",
            "name": "Stage"
          }
        }
      },
      "source": {
        "id": "PVTSSF_lADODFU6284BNtifzhAWJ9k",
        "type": "SINGLE_SELECT",
        "options": {
          "frontend": {
            "id": "1454275c",
            "name": "front-end"
          },
          "backend": {
            "id": "af2cef46",
            "name": "back-end"
          },
          "app": {
            "id": "8ce60a4c",
            "name": "app"
          }
        }
      },
      "release_date": {
        "id": "PVTF_lADODFU6284BNtifzhAWRyw",
        "type": "DATE"
      }
    }
  },
  "repo": {
    "id": "R_kgDORDbPog",
    "labels": {
      "bug": {
        "id": "LA_kwDORDbPos8AAAACWSH5lw",
        "name": "bug"
      },
      "documentation": {
        "id": "LA_kwDORDbPos8AAAACWSH5qQ",
        "name": "documentation"
      },
      "duplicate": {
        "id": "LA_kwDORDbPos8AAAACWSH5sw",
        "name": "duplicate"
      },
      "enhancement": {
        "id": "LA_kwDORDbPos8AAAACWSH5ww",
        "name": "enhancement"
      },
      "good_first_issue": {
        "id": "LA_kwDORDbPos8AAAACWSH50A",
        "name": "good first issue"
      },
      "help_wanted": {
        "id": "LA_kwDORDbPos8AAAACWSH53A",
        "name": "help wanted"
      },
      "invalid": {
        "id": "LA_kwDORDbPos8AAAACWSH57Q",
        "name": "invalid"
      },
      "question": {
        "id": "LA_kwDORDbPos8AAAACWSH5-g",
        "name": "question"
      },
      "wontfix": {
        "id": "LA_kwDORDbPos8AAAACWSH6Dw",
        "name": "wontfix"
      },
      "prerelease": {
        "id": "LA_kwDORDbPos8AAAACW_sW9Q",
        "name": "Prerelease"
      },
      "rejectedqa": {
        "id": "LA_kwDORDbPos8AAAACYn9RPg",
        "name": "Rejected-QA"
      },
      "stage": {
        "id": "LA_kwDORDbPos8AAAACYn9rSA",
        "name": "Stage"
      },
      "done": {
        "id": "LA_kwDORDbPos8AAAACYoEDlg",
        "name": "Done"
      },
      "support": {
        "id": "LA_kwDORDbPos8AAAACZCQNwA",
        "name": "#support"
      },
      "webclipper": {
        "id": "LA_kwDORDbPos8AAAACbHQr2A",
        "name": "WebClipper"
      }
    }
  }
};
