from djangosanetesting import SeleniumTestCase

class NewmanTestCase(SeleniumTestCase):
    fixtures = ['newman_admin_user']

    SUPERUSER_USERNAME = u"superman"
    SUPERUSER_PASSWORD = u"xxx"

    NEWMAN_URI = "/newman/"

    def __init__(self):
        super(NewmanTestCase, self).__init__()
        self.elements = {
            'navigation' : {
                'logout' : "//a[@class='icn logout']"
            },
            'pages' : {
                'login' : {
                    'submit' : "//input[@type='submit']"
                }
            }
        }

    def login_superuser(self):
        self.selenium.open(self.NEWMAN_URI)
        self.selenium.type("id_username", self.SUPERUSER_USERNAME)
        self.selenium.type("id_password", self.SUPERUSER_PASSWORD)
        self.selenium.click(self.elements['pages']['login']['submit'])

    def logout(self):
        self.selenium.click(self.elements['navigation']['logout'])
        self.selenium.wait_for_page_to_load(30000)
        self.selenium.is_text_present(u"Thanks for spending some quality time with the Web site today.")
